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
    // The lowest note gets 1.45 spaces of clearance and this leap is capped at two spaces.
    expect(y.f2).toBe(855);
    expect(y.f1).toBe(655);
    expect(y.f3).toBeGreaterThan(y.f1);
    expect(y.f3).toBeLessThan(y.f2);
  });

  it("stays above ledger notes and leaves volta collisions for manual editing", () => {
    const ledger = ys(withNoteHeightFingerings(page().replace("translate(100, 950)", "translate(100, 600)"), 5));
    expect(ledger.f1).toBe(600 - 100 * (0.5 + 1.45));
    const bracket = '<g class="ending"><g class="voltaBracket"><text x="1050" y="780" font-size="0px"><tspan font-size="200px">1</tspan></text>'
      + '<path d="M1000 600 L1300 600"/><path d="M1000 600 L1000 800"/></g></g>';
    const under = ys(withNoteHeightFingerings(page(bracket), 5));
    expect(under).toEqual(ys(withNoteHeightFingerings(page(), 5)));
  });

  it("uses each system's pitch range and the gap above that system", () => {
    const secondSystem = (top: number) =>
      `<g class="system"><g class="staff">${staff.replace(/\b1[0-4]00\b/g, (y) => String(Number(y) - 1000 + top))}` +
      `${note("a", 100, top + 100)}</g><g class="staff">${staff.replace(/\b1[0-4]00\b/g, (y) => String(Number(y) - 1000 + top))}` +
      `${note("b", 600, top + 150)}</g>` +
      `${fing("f4", "a", 100).replace('y="600"', `y="${top - 200}"`)}` +
      `${fing("f5", "b", 600).replace('y="600"', `y="${top - 200}"`)}</g>`;
    const first = `<g class="system">${page().slice(5, -6)}</g>`;
    const roomy = ys(withNoteHeightFingerings(`<svg>${first}${secondSystem(3000)}</svg>`, 5));
    const tight = ys(withNoteHeightFingerings(`<svg>${first}${secondSystem(2050)}</svg>`, 5));
    expect(roomy.f5).toBe(2855);
    expect(roomy.f5 - roomy.f4).toBe(200);
    expect(tight.f5).toBe(1990);
    expect(tight.f5 - tight.f4).toBe(100);
    expect(roomy.f1).toBe(tight.f1);
  });

  it("uses the same height for repeated pitches next to a coda or jump direction", () => {
    const sign = '<g class="repeatMark"><use transform="translate(600, 550) scale(0.64)"/></g>';
    const jump = '<g class="dir fine"><text x="1100" y="850">D.C. al Fine</text></g>';
    const repeated = page(sign + jump).replace("translate(1100, 1200)", "translate(1100, 1500)");
    const svg = withNoteHeightFingerings(repeated, 5);
    const result = ys(svg);
    expect(result.f2).toBe(result.f3);
    expect(result.f2).toBe(855);
    expect(result.f1).toBeLessThan(result.f2);
    expect(svg).toContain(sign);
    expect(svg).toContain(jump);
  });

  it("follows pitch even when Verovio placed numbers on a common high row", () => {
    const original = ys(withNoteHeightFingerings(page(), 5));
    const crowded = ys(withNoteHeightFingerings(page().replace(/y="600"/g, 'y="1000"'), 5));
    expect(crowded).toEqual(original);
  });

  it("distinguishes consecutive notes close enough to look like a chord", () => {
    const close = page().replace("translate(600, 1500)", "translate(155, 1500)");
    const result = ys(withNoteHeightFingerings(close, 5));
    expect(result.f1).toBeLessThan(result.f2);
  });

  it("clears the highest note of a chord while keeping the fingering attached to its own note", () => {
    const first = note("high", 100, 950);
    const chord = `<g class="chord">${first}${note("chord-top", 100, 850)}</g>`;
    const result = ys(withNoteHeightFingerings(page().replace(first, chord), 5));
    expect(result.f1).toBeLessThanOrEqual(850 - 100 * (0.5 + 2.3 + 0.6));
  });

  it("enlarges fingering text beyond Verovio's limit while preserving other text", () => {
    const otherText = '<text><tspan font-size="290px">Tempo</tspan></text>';
    const svg = withNoteHeightFingerings(page(otherText), 5, 1.5);
    expect(svg.match(/font-size="435px"/g)).toHaveLength(3);
    expect(svg).toContain(otherText);
    expect(ys(svg)).toEqual(ys(withNoteHeightFingerings(page(), 5)));
  });

  it("leaves pages without fingerings alone", () => {
    expect(withNoteHeightFingerings("<svg/>", 5)).toBe("<svg/>");
  });
});
