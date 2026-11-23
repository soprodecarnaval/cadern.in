import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { condenseRestRuns } from "./restRuns";

const rest = '<note><rest measure="yes"/><duration>4</duration><voice>1</voice></note>';
const note = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>';
const measure = (body: string) => `<measure>${body}</measure>`;
const part = (...measures: string[]) =>
  new DOMParser().parseFromString(`<score-partwise><part id="P1">${measures.join("")}</part></score-partwise>`, "application/xml")
    .getElementsByTagName("part")[0] as unknown as Element;
const runs = (...measures: string[]) => condenseRestRuns(part(...measures)).runs;
const R = measure(rest), N = measure(note);

describe("condenseRestRuns", () => {
  it("merges runs of two or more rest-only measures", () => {
    expect(runs(N, R, R, R, N, R, N, R, R)).toEqual([{ first: 1, count: 3 }, { first: 7, count: 2 }]);
    const p = part(N, R, R);
    condenseRestRuns(p);
    const style = p.getElementsByTagName("multiple-rest")[0];
    expect(style.textContent).toBe("2");
    expect((style.parentNode!.parentNode as Element).localName).toBe("attributes");
  });

  it("lets a run start with a change or marking, but not continue through one", () => {
    const rehearsal = measure(`<direction><direction-type><rehearsal>B</rehearsal></direction-type></direction>${rest}`);
    const keyChange = measure(`<attributes><key><fifths>2</fifths></key></attributes>${rest}`);
    expect(runs(rehearsal, R, R)).toEqual([{ first: 0, count: 3 }]);
    expect(runs(R, R, rehearsal, R)).toEqual([{ first: 0, count: 2 }, { first: 2, count: 2 }]);
    expect(runs(R, keyChange, R)).toEqual([{ first: 1, count: 2 }]);
  });

  it("keeps markings after the rest, repeats and voltas out of the middle of a run", () => {
    const jump = measure(`${rest}<direction><direction-type><words>D.C.</words></direction-type><sound dacapo="yes"/></direction>`);
    const endRepeat = measure(`${rest}<barline location="right"><repeat direction="backward"/></barline>`);
    const startRepeat = measure(`<barline location="left"><repeat direction="forward"/></barline>${rest}`);
    expect(runs(R, jump, R)).toEqual([]);
    expect(runs(R, endRepeat, R, R)).toEqual([{ first: 0, count: 2 }, { first: 2, count: 2 }]);
    expect(runs(R, startRepeat, R)).toEqual([{ first: 1, count: 2 }]);
  });

  it("merges whole-measure rests only", () => {
    const halves = measure('<note><rest/><duration>2</duration><type>half</type></note><note><rest/><duration>2</duration><type>half</type></note>');
    expect(runs(R, halves, R, R)).toEqual([{ first: 2, count: 2 }]);
  });

  it("leaves multi-voice measures and multi-staff parts alone", () => {
    expect(runs(R, measure(`${rest}<backup><duration>4</duration></backup>${rest}`), R)).toEqual([]);
    expect(runs(measure(`<attributes><staves>2</staves></attributes>${rest}`), R, R)).toEqual([]);
  });
});
