import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS engine module, loaded in the worker at run time
import { withNoteHeightFingerings } from "./engine/renderer.js";

// unit 5: a staff space is 100 units; staff top line at y=1000.
const staff = [0, 1, 2, 3, 4].map((line) => `<path d="M0 ${1000 + line * 100} L5000 ${1000 + line * 100}" stroke-width="13"/>`).join("");
const note = (id: string, x: number, y: number) =>
  `<g id="${id}" class="note"><g class="notehead"><use xlink:href="#E0A4" transform="translate(${x}, ${y}) scale(0.5, 0.5)"/></g></g>`;
const fing = (id: string, note: string, x: number) =>
  `<g id="${id}" class="fing" data-startid="#${note}"><text x="${x}" y="600" font-size="0px"><tspan font-size="290px">1</tspan></text></g>`;
const page = (extra = "") =>
  `<svg><g class="staff">${staff}${note("high", 100, 950)}${note("low", 600, 1500)}${note("mid", 1100, 1200)}${extra}</g>` +
  `${fing("f1", "high", 100)}${fing("f2", "low", 600)}${fing("f3", "mid", 1100)}</svg>`;
const ys = (svg: string) => Object.fromEntries([...svg.matchAll(/id="(f\d)"[^>]*>\s*<text x="\d+" y="(\d+)"/g)].map((m) => [m[1], Number(m[2])]));

describe("withNoteHeightFingerings", () => {
  it("floats every number above the staff, higher for higher notes", () => {
    const y = ys(withNoteHeightFingerings(page(), 5));
    // Never inside the staff: at least 0.6 spaces above the top line (1000).
    for (const value of Object.values(y)) {expect(value).toBeLessThanOrEqual(940);}
    // The band: the lowest note just above the staff, the highest 2 spaces higher.
    expect(y.f2).toBe(940);
    expect(y.f1).toBe(740);
    expect(y.f3).toBeGreaterThan(y.f1);
    expect(y.f3).toBeLessThan(y.f2);
  });

  it("stays above notes over the staff, and below volta brackets", () => {
    const ledger = ys(withNoteHeightFingerings(page().replace("translate(100, 950)", "translate(100, 600)"), 5));
    expect(ledger.f1).toBe(600 - 100 * (0.5 + 0.6));
    const bracket = '<g class="ending"><g class="voltaBracket"><text x="1050" y="780" font-size="0px"><tspan font-size="200px">1</tspan></text>'
      + '<path d="M1000 600 L1300 600"/><path d="M1000 600 L1000 800"/></g></g>';
    const under = ys(withNoteHeightFingerings(page(bracket), 5));
    expect(under.f3).toBe(940);
  });

  it("never rises more than the reserved room above Verovio's row", () => {
    const tight = ys(withNoteHeightFingerings(page().replace(/y="600"/g, 'y="1000"'), 5));
    expect(tight.f1).toBe(1000 - 200);
  });

  it("leaves pages without fingerings alone", () => {
    expect(withNoteHeightFingerings("<svg/>", 5)).toBe("<svg/>");
  });
});
