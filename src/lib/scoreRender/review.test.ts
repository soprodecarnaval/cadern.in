import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { clefsOf, compareFingerings, storedPageLayout } from "./review";

const parse = (text: string) => new DOMParser().parseFromString(text, "application/xml") as unknown as Document;
const note = (f?: string) => `<note><pitch><step>C</step><octave>4</octave></pitch>${f ? `<notations><technical><fingering>${f}</fingering></technical></notations>` : ""}</note>`;
const part = (...notes: string[]) => parse(`<score-partwise><part id="P1"><measure><attributes><clef><sign>F</sign><line>4</line><clef-octave-change>-1</clef-octave-change></clef></attributes>${notes.join("")}</measure></part></score-partwise>`);

describe("sign-off measures", () => {
  it("compares the plugin's fingerings with the browser's, note by note", () => {
    const match = compareFingerings(part(note("1"), note("12"), note(), note("3")), part(note("1"), note("4"), note("2"), note()));
    expect(match).toEqual({ plugin: 3, same: 1, extra: 1, differences: { "12→4": 1, "3→∅": 1 } });
  });

  it("lists clefs", () => {
    expect(clefsOf(part())).toEqual(["F4/-1"]);
  });

  it("measures staff space and systems of a stored MuseScore page", () => {
    const lines = [0, 1].flatMap((system) => [0, 1, 2, 3, 4].map((line) =>
      `<polyline class="StaffLines" fill="none" points="70,${100 + system * 500 + line * 50.4} 4100,${100 + system * 500 + line * 50.4}"/>`));
    const svg = `<svg viewBox="0 0 4208.47 2409.45">${lines.join("")}</svg>`;
    expect(storedPageLayout(svg, 171.7)).toEqual({ staffSpaceMm: 2.056, systems: 2 });
    expect(storedPageLayout("<svg/>", 171.7)).toBeNull();
  });
});
