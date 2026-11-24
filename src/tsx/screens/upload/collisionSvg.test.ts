import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveMarking } from "./collisionSvg";

const page = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 90">
  <g id="note" class="note"><path d="M0 0h1"/></g>
  <g id="pirata" class="fing" transform="scale(2)"><text>1</text></g>
  <g id="segno" class="repeatMark"><path d="M10 0h1"/></g>
  <g id="jump" class="dir dacapo"><text>D.C.</text></g>
  <g class="ending systemMilestone" id="ending-start"/>
  <g id="repeat-barline" class="barLine"><path d="M15 0v5"/></g>
  <g class="ending id-ending-start spanning"><g class="voltaBracket"><path d="M16 0h5"/></g></g>
  <g class="ending id-ending-start spanning"><g class="voltaBracket"><path d="M26 0h5"/></g></g>
  <g id="section" class="reh"><rect width="5" height="5"/><text>A</text></g>
</svg>`;

const transform = (svg: string, id: string) =>
  new DOMParser().parseFromString(svg, "image/svg+xml")?.getElementById(id)?.getAttribute("transform") || null;

describe("manual score corrections", () => {
  beforeEach(() => {
    vi.stubGlobal("DOMParser", DOMParser);
    vi.stubGlobal("XMLSerializer", XMLSerializer);
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  it("moves only the selected marking in parent units and preserves its transform", () => {
    const moved = moveMarking(page, { id: "pirata", x: 2.5, y: -4 })!;
    expect(transform(moved, "pirata")).toBe("translate(2.5 -4) scale(2)");
    expect(transform(moved, "section")).toBeNull();
    expect(transform(moved, "note")).toBeNull();

    const both = moveMarking(moved, { id: "section", x: 0, y: -2 })!;
    expect(transform(both, "section")).toBe("translate(0 -2)");
    expect(transform(both, "pirata")).toBe("translate(2.5 -4) scale(2)");
  });

  it("moves repeat signs, jump text and individual volta brackets", () => {
    const segno = moveMarking(page, { id: "segno", x: 2, y: -3 })!;
    expect(transform(segno, "segno")).toBe("translate(2 -3)");
    const jump = moveMarking(segno, { id: "jump", x: 0, y: 1 })!;
    expect(transform(jump, "jump")).toBe("translate(0 1)");

    const ending = moveMarking(jump, { voltaIndex: 1, x: 0, y: -2 })!;
    const groups = Array.from(new DOMParser().parseFromString(ending, "image/svg+xml")!.getElementsByTagName("g"));
    const brackets = groups.filter((group) => group.getAttribute("class") === "voltaBracket");
    expect(brackets.map((group) => group.getAttribute("transform") || null)).toEqual([null, "translate(0 -2)"]);
    expect(transform(ending, "ending-start")).toBeNull();
    expect(moveMarking(ending, { id: "repeat-barline", x: 1, y: 0 })).toBeNull();
  });

  it("prints the manual translation through the songbook SVG renderer", async () => {
    const svg = moveMarking(page, { id: "section", x: 2.5, y: -4 })!;
    const doc = new PDFDocument({ compress: false });
    const chunks: Buffer[] = [];
    const output = new Promise<string>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
      doc.on("error", reject);
    });
    SVGtoPDF(doc, svg, 0, 0, { width: 150, height: 90 });
    doc.end();

    expect(await output).toContain("1 0 0 1 2.5 -4 cm");
  });

  it("leaves notes, missing groups and invalid or unchanged positions alone", () => {
    for (const move of [
      { id: "note", x: 2, y: 1 },
      { id: "missing", x: 2, y: 1 },
      { id: "pirata", x: 0, y: 0 },
      { id: "pirata", x: Infinity, y: 1 },
    ]) {
      expect(moveMarking(page, move)).toBeNull();
    }
  });
});
