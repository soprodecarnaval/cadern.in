import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Requires local Storybook. Uses local PDFKit/blob-stream and no Firebase.
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:6006";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["http:", "https:"].includes(url.protocol) && url.origin !== new URL(base).origin
      ? route.abort() : route.continue();
  });
  await page.goto(`${base}/iframe.html?id=screens-songbookgenerationpanel--ready&viewMode=story`);
  await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.storyRenders?.[0]?.phase === "finished");
  await page.addScriptTag({ path: "node_modules/pdfkit/js/pdfkit.standalone.js" });
  await page.addScriptTag({ content: execFileSync(process.execPath,
    ["node_modules/browserify/bin/cmd.js", "node_modules/blob-stream/index.js", "--standalone", "blobStream"],
    { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }) });

  for (const kind of ["portrait-png", "landscape-jpeg", "carnival", "default"]) {
    const preview = await page.evaluate(async (kind) => {
      const { createSongbookCoverPreview } = await import("/src/createSongBook.ts");
      const canvas = document.createElement("canvas");
      canvas.width = kind === "portrait-png" ? 240 : 720;
      canvas.height = kind === "portrait-png" ? 480 : 520;
      const context = canvas.getContext("2d");
      context.fillStyle = "#267b7c";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffdd16";
      context.fillRect(20, 20, 60, 60);
      const part = { name: "Flauta", instrument: "flauta", midi: "", svg: [
        "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="white"/></svg>'),
      ] };
      const revision = { id: "pin", revisionNumber: 1, parts: [part] };
      const score = { id: "test-score", title: "Música de teste", composer: "Compositor", sub: "", tags: [], latestRevision: revision };
      window.__coverOptions = {
        title: "Capa de teste", instrument: "flauta",
        sections: kind === "default" ? [{ title: "Test", scores: [{ score, revision, index: 1 }] }] : [],
        coverImageUrl: ["carnival", "default"].includes(kind) ? "" : canvas.toDataURL(kind === "landscape-jpeg" ? "image/jpeg" : "image/png"),
        carnivalMode: kind === "carnival", backSheetPageNumber: false, antiAssedioPages: false,
      };
      const url = await createSongbookCoverPreview(window.__coverOptions);
      const blob = await fetch(url).then((response) => response.blob());
      const image = await createImageBitmap(blob);
      if (Math.abs(image.width / image.height - 18 / 13) > 0.01) { throw new Error("Wrong preview ratio"); }
      URL.revokeObjectURL(url);
      image.close();
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    }, kind);
    const download = page.waitForEvent("download");
    await page.evaluate(async () => {
      const { createSongBook } = await import("/src/createSongBook.ts");
      await createSongBook(window.__coverOptions);
    });
    const pdf = await readFile(await (await download).path());
    assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
    const generatedImage = await page.evaluate(async (bytes) => {
      const { pdfFirstPageImage } = await import("/src/lib/pdfPreview.ts");
      const pdfUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      const imageUrl = await pdfFirstPageImage(pdfUrl);
      const result = Array.from(new Uint8Array(await fetch(imageUrl).then((response) => response.arrayBuffer())));
      URL.revokeObjectURL(pdfUrl);
      URL.revokeObjectURL(imageUrl);
      return result;
    }, Array.from(pdf));
    assert.deepEqual(preview, generatedImage, `${kind}: preview differs from generated PDF first page`);
    console.log(`PASS ${kind}: preview pixels match generated PDF first page`);
  }
  const invalidRejected = await page.evaluate(async () => {
    const { createSongbookCoverPreview } = await import("/src/createSongBook.ts");
    const badImage = URL.createObjectURL(new Blob(["not an image"], { type: "image/png" }));
    try {
      await createSongbookCoverPreview({ ...window.__coverOptions, coverImageUrl: badImage, carnivalMode: false });
      return false;
    } catch {
      return true;
    } finally { URL.revokeObjectURL(badImage); }
  });
  assert.ok(invalidRejected, "Corrupt image must fail preview before saving");
  console.log("PASS corrupt image rejected");
} finally { await browser.close(); }
