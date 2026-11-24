import { Writable } from "node:stream";
import PDFDocument from "pdfkit";
import { afterEach, expect, it, vi } from "vitest";
import { createArrangementPdf } from "./createSongBook";

vi.mock("./lib/sharedFonts", async (importOriginal) => ({
  ...await importOriginal<typeof import("./lib/sharedFonts")>(),
  loadTextFonts: () => Promise.resolve([]),
}));

afterEach(() => {vi.unstubAllGlobals();});

it("downloads exactly the saved arrangement pages as A4 landscape", async () => {
  const data: Buffer[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      data.push(chunk);
      done();
    },
  });
  const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal("window", {
    PDFDocument,
    blobStream: () => Object.assign(stream, { toBlobURL: () => "blob:arrangement" }),
    URL: { revokeObjectURL: vi.fn() },
  });
  vi.stubGlobal("document", { createElement: () => link, body: { appendChild: vi.fn() } });
  const pages = ["/arrangement-1.svg", "/arrangement-2.svg"];
  const fetchPage = vi.fn((url: string) => Promise.resolve(new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210"><path d="M10 10L20 ${url === pages[0] ? 20 : 30}" stroke="black"/></svg>`,
  )));
  vi.stubGlobal("fetch", fetchPage);

  await createArrangementPdf(pages, "Abre Alas");

  expect(fetchPage.mock.calls).toEqual(pages.map((page) => [page]));
  expect(link.download).toBe("Abre Alas-arranjo.pdf");
  expect(link.click).toHaveBeenCalledOnce();
  const pdf = Buffer.concat(data).toString("latin1");
  expect([...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((match) => match.slice(1)))
    .toEqual([["841.89", "595.28"], ["841.89", "595.28"]]);
});
