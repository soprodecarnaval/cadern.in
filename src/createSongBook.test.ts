import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScoreViewModel, ScoreRevisionViewModel } from "../types/viewModels";
import type { CreateSongBookOptions } from "./createSongBook";
import SVGtoPDF from "svg-to-pdfkit";

vi.mock("svg-to-pdfkit", () => ({ default: vi.fn() }));

const anchor = { click: vi.fn(), href: "", download: "" };
let finish: (() => void) | undefined;
const stream = {
  on: vi.fn((_event: string, callback: () => void) => { finish = callback; }),
  toBlobURL: vi.fn(() => "blob:pdf"),
};
class PdfDocument {
  static instances: PdfDocument[] = [];
  constructor() { PdfDocument.instances.push(this); }
  font = vi.fn(() => this);
  fontSize = vi.fn(() => this);
  text = vi.fn(() => this);
  addPage = vi.fn(() => this);
  fillColor = vi.fn(() => this);
  rect = vi.fn(() => this);
  fillAndStroke = vi.fn(() => this);
  stroke = vi.fn(() => this);
  widthOfString = vi.fn((text: string) => text.length);
  currentLineHeight = vi.fn(() => 10);
  addNamedDestination = vi.fn();
  registerFont = vi.fn();
  switchToPage = vi.fn();
  image = vi.fn();
  pipe = vi.fn(() => stream);
  end = vi.fn(() => finish?.());
  outline = { addItem: vi.fn(() => ({ addItem: vi.fn() })) };
}
let createSongBook: typeof import("./createSongBook").createSongBook;
const fetchMock = vi.fn<typeof fetch>();
const svgUrl = "https://example.com/score.svg?token=private-token";
const revision = {
  id: "r1",
  parts: [{ name: "Trompete com pirata", instrument: "trompete", svg: [svgUrl], midi: "" }],
} as ScoreRevisionViewModel;
const score = {
  id: "score", title: "Chuva, Suor e Cerveja", composer: "", sub: "", latestRevision: revision,
} as ScoreViewModel;
const options = (): CreateSongBookOptions => ({
  title: "Test songbook", instrument: "trompete", sections: [{ title: "Axé", scores: [{ score, revision, index: 1 }] }],
  coverImageUrl: "", backSheetPageNumber: false, carnivalMode: false, antiAssedioPages: false,
});

beforeAll(async () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) => tag === "a" ? anchor : {
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => "data:image/png;base64,cG5n",
    },
    body: { appendChild: vi.fn() },
  });
  ({ createSongBook } = await import("./createSongBook"));
});
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(SVGtoPDF).mockReset();
  PdfDocument.instances = [];
  finish = undefined;
  vi.stubGlobal("window", { PDFDocument: PdfDocument, blobStream: () => stream, URL: { revokeObjectURL: vi.fn() } });
  vi.stubGlobal("Image", class {
    naturalWidth = 10;
    naturalHeight = 10;
    onload?: () => void;
    set src(_url: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation((input) => Promise.resolve(
    String(input).endsWith(".ttf") ? new Response(new Uint8Array([1])) : new Response('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  ));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function failSvg(response: () => Promise<Response>) {
  fetchMock.mockImplementation(input => String(input).endsWith(".ttf")
    ? Promise.resolve(new Response(new Uint8Array([1])))
    : response());
}
function expectNoDownload() {
  expect(anchor.click).not.toHaveBeenCalled();
  expect(PdfDocument.instances[0].pipe).not.toHaveBeenCalled();
  expect(PdfDocument.instances[0].end).not.toHaveBeenCalled();
}

describe("songbook SVG failures", () => {
  it("rejects a network failure with the score and part, without downloading", async () => {
    failSvg(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(createSongBook(options())).rejects.toThrow(/Chuva, Suor e Cerveja.*Trompete com pirata/);
    expectNoDownload();
  });

  it.each([403, 404, 500])("rejects HTTP %s before rendering its error body", async status => {
    failSvg(() => Promise.resolve(new Response("Error page", { status })));
    await expect(createSongBook(options())).rejects.toThrow(/Chuva, Suor e Cerveja/);
    expect(SVGtoPDF).not.toHaveBeenCalled();
    expectNoDownload();
  });

  it("rejects failed response-body reads", async () => {
    const response = new Response("broken stream");
    vi.spyOn(response, "text").mockRejectedValue(new Error("Body read failed"));
    failSvg(() => Promise.resolve(response));
    await expect(createSongBook(options())).rejects.toThrow(/Chuva, Suor e Cerveja/);
    expectNoDownload();
  });

  it("rejects renderer failures instead of downloading an incomplete PDF", async () => {
    vi.mocked(SVGtoPDF).mockImplementation(() => { throw new Error("Cannot render"); });
    await expect(createSongBook(options())).rejects.toThrow(/Chuva, Suor e Cerveja/);
    expectNoDownload();
  });

  it("identifies the failed SVG page and never exposes its URL token", async () => {
    const opts = options();
    opts.sections[0].scores[0] = {
      score, index: 1, revision: { ...revision, parts: [{ ...revision.parts[0], svg: [svgUrl, "https://example.com/page-2.svg?token=secret"] }] },
    };
    fetchMock.mockImplementation(input => String(input).includes("page-2")
      ? Promise.reject(new Error("secret"))
      : Promise.resolve(new Response("<svg/>")));
    const failure = await createSongBook(opts).then(() => null, (error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/página 2/);
    expect((failure as Error).message).not.toMatch(/https:|token|secret/);
    expectNoDownload();
  });

  it("allows a successful retry after a failure", async () => {
    failSvg(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(createSongBook(options())).rejects.toThrow();
    fetchMock.mockImplementation(input => Promise.resolve(new Response(String(input).endsWith(".ttf") ? "font" : "<svg/>")));
    await createSongBook(options());
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(PdfDocument.instances[0].end).not.toHaveBeenCalled();
    expect(PdfDocument.instances[1].end).toHaveBeenCalledOnce();
  });

  it("keeps the sponsored back image behind the page's text", async () => {
    await createSongBook({ ...options(), backSheetPageNumber: true });
    const doc = PdfDocument.instances[0];
    expect(doc.image).toHaveBeenCalledOnce();
    expect(doc.image.mock.invocationCallOrder[0]).toBeLessThan(
      doc.text.mock.invocationCallOrder[doc.text.mock.invocationCallOrder.length - 1],
    );
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it("handles immediate SVG rejection after asynchronous back-page layout", async () => {
    failSvg(() => Promise.reject(new TypeError("Failed to fetch")));
    const opts = options();
    opts.backSheetPageNumber = true;
    opts.sections[0].scores.push({ score: { ...score, id: "second" }, revision, index: 2 });
    await expect(createSongBook(opts)).rejects.toThrow(/Chuva, Suor e Cerveja/);
    expect(PdfDocument.instances[0].image).toHaveBeenCalledTimes(2);
    expectNoDownload();
  });

  it("downloads only after every SVG has rendered successfully", async () => {
    let complete!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { complete = resolve; });
    failSvg(() => pending);
    const generation = createSongBook(options());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith(svgUrl));
    expect(anchor.click).not.toHaveBeenCalled();
    complete(new Response("<svg/>"));
    await generation;
    expect(SVGtoPDF).toHaveBeenCalledOnce();
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
