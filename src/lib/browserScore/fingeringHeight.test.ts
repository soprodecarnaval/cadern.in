import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS engine module, loaded in the worker at run time
import { withNoteHeightFingerings } from "./engine/renderer.js";

// unit 5: a staff space is 100 units; staff top line at y=1000.
const staff = [0, 1, 2, 3, 4].map((line) => `<path d="M0 ${1000 + line * 100} L5000 ${1000 + line * 100}" stroke-width="13"/>`).join("");
const note = (id: string, x: number, y: number) =>
  `<g id="${id}" class="note"><g class="notehead"><use xlink:href="#E0A4" transform="translate(${x}, ${y}) scale(0.5, 0.5)"/></g></g>`;
const fing = (id: string, note: string, x: number) =>
  `<g id="${id}" class="fing" data-startid="#${note}"><text x="${x}" y="600" font-size="0px"><tspan>1</tspan></text></g>`;
const page = (extra = "") =>
  `<svg><g class="staff">${staff}${note("high", 100, 950)}${note("low", 600, 1500)}${note("mid", 1100, 1200)}${extra}</g>` +
  `${fing("f1", "high", 100)}${fing("f2", "low", 600)}${fing("f3", "mid", 1100)}</svg>`;
const ys = (svg: string) => Object.fromEntries([...svg.matchAll(/id="(f\d)"[^>]*>\s*<text x="\d+" y="(\d+)"/g)].map((m) => [m[1], Number(m[2])]));

describe("withNoteHeightFingerings", () => {
  it("puts each number above its own note, following the melody, never above Verovio's row", () => {
    const y = ys(withNoteHeightFingerings(page(), 5));
    // The highest note gets the most extra rise: 950 - (0.5 + 0.6 + 1.5) spaces.
    expect(y.f1).toBe(690);
    expect(y.f3).toBeGreaterThan(y.f1);
    expect(y.f2).toBeGreaterThan(y.f3);
    expect(withNoteHeightFingerings(page().replace(/y="600"/g, 'y="800"'), 5)).toContain('y="800"');
    // Just above the low note: notehead top (1450) minus the gap.
    expect(y.f2).toBe(1500 - 100 * (0.5 + 0.6));
  });

  it("goes above a chord's top note and above articulations", () => {
    const chord = withNoteHeightFingerings(page(note("upper", 600, 1300)), 5);
    // Above the chord's top note (1300), one chord step higher; it is now the page's lowest anchor.
    expect(ys(chord).f2).toBe(1300 - 100 * (0.5 + 0.6 + 2.3));
    const staccato = withNoteHeightFingerings(page('<g class="artic"><g class="articPart"><use transform="translate(600, 1380)"/></g></g>'), 5);
    expect(ys(staccato).f2).toBeLessThan(1380);
  });

  it("leaves pages without fingerings alone", () => {
    expect(withNoteHeightFingerings("<svg/>", 5)).toBe("<svg/>");
  });
});
