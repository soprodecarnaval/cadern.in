import { chromium } from "playwright";
import assert from "node:assert/strict";

// Requires local Storybook. Exercises the real canvas preview without PDF globals.
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:6006";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["http:", "https:"].includes(url.protocol) && url.origin !== new URL(base).origin
      ? route.abort() : route.continue();
  });
  await page.goto(`${base}/iframe.html?id=screens-songbookgenerationpanel--ready&viewMode=story`);
  await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.storyRenders?.[0]?.phase === "finished");
  await page.evaluate(() => {
    for (const name of ["PDFDocument", "blobStream"]) {
      Object.defineProperty(window, name, { configurable: true, get() { throw new Error("Preview accessed PDF engine"); } });
    }
  });
  for (const kind of ["portrait-png", "wide-jpeg", "transparent-png", "carnival", "default", "long-title", "custom-over-carnival"]) {
    const result = await page.evaluate(async (kind) => {
      const { createSongbookCoverPreview } = await import("/src/lib/pdfPreview.ts");
      const source = document.createElement("canvas");
      source.width = kind === "portrait-png" ? 240 : 720;
      source.height = kind === "portrait-png" ? 480 : 240;
      const sourceContext = source.getContext("2d");
      if (kind !== "transparent-png") {
        sourceContext.fillStyle = "#267b7c";
        sourceContext.fillRect(0, 0, source.width, source.height);
      }
      const url = await createSongbookCoverPreview({
        title: kind === "long-title" ? "CADERNINHO COM UM TÍTULO EXTREMAMENTE LONGO ".repeat(3) : "Carnaval 2026",
        instrument: "flauta",
        coverImageUrl: ["carnival", "default", "long-title"].includes(kind) ? "" : source.toDataURL(kind === "wide-jpeg" ? "image/jpeg" : "image/png"),
        carnivalMode: ["carnival", "custom-over-carnival"].includes(kind),
      });
      try {
        const image = await createImageBitmap(await fetch(url).then((response) => response.blob()));
        const canvas = document.createElement("canvas");
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const rgba = (x, y) => Array.from(context.getImageData(Math.floor(image.width * x), Math.floor(image.height * y), 1, 1).data);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        let dark = 0;
        for (let i = 0; i < pixels.length; i += 4) { if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) { dark++; } }
        const result = { ratio: image.width / image.height, middle: rgba(0.5, 0.5), left: rgba(0.1, 0.75), top: rgba(0.5, 0.02), dark };
        image.close();
        return result;
      } finally { URL.revokeObjectURL(url); }
    }, kind);
    assert.ok(Math.abs(result.ratio - 18 / 13) < 0.01, `${kind}: wrong page ratio`);
    if (["portrait-png", "wide-jpeg", "custom-over-carnival"].includes(kind)) {
      assert.ok(result.middle.slice(0, 3).every((channel, index) => Math.abs(channel - [38, 123, 124][index]) < 4), `${kind}: image did not retain its center`);
    }
    if (kind === "portrait-png") { assert.deepEqual(result.left, [255, 255, 255, 255], "Portrait image must leave centered side margins"); }
    if (kind === "wide-jpeg") { assert.deepEqual(result.top, [255, 255, 255, 255], "Wide image must leave top/bottom margins"); }
    if (["transparent-png", "default", "long-title"].includes(kind)) { assert.ok(result.dark > 100, `${kind}: title/instrument missing`); }
    console.log(`PASS ${kind}: canvas preview geometry/composition`);
  }
  const rejected = await page.evaluate(async () => {
    const { createSongbookCoverPreview } = await import("/src/lib/pdfPreview.ts");
    const bad = URL.createObjectURL(new Blob(["not an image"], { type: "image/png" }));
    try {
      await createSongbookCoverPreview({ title: "Teste", instrument: "flauta", coverImageUrl: bad, carnivalMode: false });
      return false;
    } catch { return true; } finally { URL.revokeObjectURL(bad); }
  });
  assert.ok(rejected, "Corrupt image must fail before saving");
  assert.equal(requests.filter((url) => url.includes("capa_carnaval_2026_flauta.png")).length, 1, "Carnival image must only be loaded as fallback");
  assert.ok(!requests.some((url) => /pdfjs|pdf\.worker/i.test(url)), "Preview loaded a PDF dependency");
  console.log("PASS corrupt image rejected; no PDF engine or worker used");
} finally { await browser.close(); }
