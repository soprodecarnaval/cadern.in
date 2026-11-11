import { chromium } from "playwright";

const base = new URL(process.env.STORYBOOK_URL ?? "http://127.0.0.1:6006");
const index = await fetch(new URL("index.json", base)).then((response) => {
  if (!response.ok) {
    throw new Error(`Story index: ${response.status}`);
  }
  return response.json();
});
const ids = Object.values(index.entries)
  .filter((entry) => entry.type === "story")
  .map((entry) => entry.id);
if (!ids.length) {
  throw new Error("No stories found in index.json");
}
const browser = await chromium.launch();
const failures = [];
let next = 0;
try {
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      let errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (
          ["http:", "https:"].includes(url.protocol) &&
          url.origin !== base.origin
        ) {
          errors.push(`External request: ${url.origin}${url.pathname}`);
          return route.abort();
        }
        return route.continue();
      });
      await page.addInitScript(() => {
        window.__storybookAudioContexts = 0;
        if (window.AudioContext) {
          window.AudioContext = new Proxy(window.AudioContext, {
            construct(target, args) {
              window.__storybookAudioContexts++;
              return Reflect.construct(target, args);
            },
          });
        }
        localStorage.setItem(
          "cadernin:builder",
          "storybook-isolation-sentinel",
        );
      });
      while (next < ids.length) {
        const id = ids[next++];
        errors = [];
        try {
          await page.goto(
            new URL(`iframe.html?id=${id}&viewMode=story`, base).href,
          );
          await page.waitForFunction(() => {
            const render = window.__STORYBOOK_PREVIEW__?.storyRenders?.[0];
            if (render?.phase === "errored") {
              throw new Error("Story render/play failed");
            }
            return render?.phase === "finished";
          });
          await page.waitForLoadState("networkidle");
          const isolation = await page.evaluate(() => ({
            audio: window.__storybookAudioContexts,
            builder: localStorage.getItem("cadernin:builder"),
          }));
          if (
            isolation.audio ||
            isolation.builder !== "storybook-isolation-sentinel"
          ) {
            errors.push(`Isolation failed: ${JSON.stringify(isolation)}`);
          }
          if (errors.length) {
            throw new Error(errors.join("\n"));
          }
          console.log(`PASS ${id}`);
        } catch (error) {
          const message = `${id}: ${error.message}\n${errors.join("\n")}`;
          failures.push(message);
          console.error(`FAIL ${message}`);
        }
      }
      await page.close();
    }),
  );
} finally {
  await browser.close();
}
console.log(`${ids.length - failures.length}/${ids.length} stories passed`);
if (failures.length) {
  process.exitCode = 1;
}
