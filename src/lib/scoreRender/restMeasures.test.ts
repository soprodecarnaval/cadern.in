import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { narrowRestMeasures } from "./restMeasures";

const rest = '<note><rest measure="yes"/><duration>16</duration><voice>1</voice></note>';
const note = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration></note>';
const measure = (body: string) => `<measure>${body}</measure>`;
const part = (...measures: string[]) =>
  new DOMParser().parseFromString(`<score-partwise><part id="P1">${measures.join("")}</part></score-partwise>`, "application/xml")
    .getElementsByTagName("part")[0] as unknown as Element;

describe("narrowRestMeasures", () => {
  it("keeps every rest measure, as a whole rest one beat long", () => {
    const p = part(measure(`<attributes><divisions>4</divisions></attributes>${note}`), measure(rest), measure(rest), measure(note));
    expect(narrowRestMeasures(p).narrowed).toEqual([1, 2]);
    const rests = Array.from(p.getElementsByTagName("rest"));
    expect(rests).toHaveLength(2);
    for (const element of rests) {
      const n = element.parentNode as Element;
      expect(element.hasAttribute("measure")).toBe(false);
      expect(n.getElementsByTagName("duration")[0].textContent).toBe("4");
      const order = Array.from(n.childNodes).filter((c) => c.nodeType === 1).map((c) => (c as Element).localName);
      expect(order).toEqual(["rest", "duration", "voice", "type"]);
      expect(n.getElementsByTagName("type")[0].textContent).toBe("whole");
    }
    expect(p.getElementsByTagName("multiple-rest")).toHaveLength(0);
  });

  it("leaves shorter rests, several voices and several staves alone", () => {
    const halves = measure('<note><rest/><duration>8</duration><type>half</type></note><note><rest/><duration>8</duration><type>half</type></note>');
    const voices = measure(`${rest}<backup><duration>16</duration></backup>${rest}`);
    expect(narrowRestMeasures(part(halves, voices)).narrowed).toEqual([]);
    expect(narrowRestMeasures(part(measure(`<attributes><staves>2</staves></attributes>${rest}`))).narrowed).toEqual([]);
  });
});
