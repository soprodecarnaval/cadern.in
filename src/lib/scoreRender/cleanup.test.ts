import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { cleanupMusicXmlText, withoutMarkup, type CleanupOptions } from "./cleanup";

const xml = {
  parse: (text: string) =>
    new DOMParser().parseFromString(text, "application/xml") as unknown as Document,
  serialize: (document: Document) =>
    new XMLSerializer().serializeToString(
      document as unknown as Parameters<XMLSerializer["serializeToString"]>[0],
    ),
};

const direction = (types: string, sound = "") =>
  `<direction placement="above">${types}${sound}</direction>`;
const words = (value: string, attributes = "") =>
  `<direction-type><words${attributes}>${value}</words></direction-type>`;
const note = (extra = "") =>
  `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>${extra}</note>`;
const FINGERED = note(
  "<notations><technical><fingering>12</fingering></technical></notations>",
);
const FINGERED_WITH_BOW = note(
  "<notations><technical><up-bow/><fingering>1</fingering></technical><fermata/></notations>",
);

const SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Eva</work-title></work>
  <movement-title>Eva</movement-title>
  <identification><creator type="composer">Banda Eva</creator><encoding><software>MuseScore</software></encoding></identification>
  <credit page="1"><credit-type>title</credit-type><credit-words>Eva</credit-words></credit>
  <credit page="1"><credit-words>Fórmula: A - B - A</credit-words></credit>
  <part-list><score-part id="P1"><part-name>Trompete</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      ${direction(words("Allegro", ' font-weight="bold"'), '<sound tempo="120"/>')}
      ${direction("<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type>", '<sound tempo="120"/>')}
      ${direction("<direction-type><rehearsal>A</rehearsal></direction-type>")}
      ${direction("<direction-type><segno/></direction-type>", '<sound segno="segno"/>')}
      ${direction(words("12"))}
      ${direction(words("solo"))}
      ${direction(words("dolce", ' font-style="italic"'))}
      ${direction("<direction-type><dynamics><mf/></dynamics></direction-type>", '<sound dynamics="88"/>')}
      ${direction("<direction-type><wedge type=\"crescendo\"/></direction-type>")}
      ${FINGERED}
      ${FINGERED_WITH_BOW}
    </measure>
    <measure number="2">
      ${direction(words("To <sym>coda</sym>".replace(/</g, "&lt;").replace(/>/g, "&gt;")))}
      ${direction(words("D.S. al Coda"), '<sound dalsegno="segno"/>')}
      ${direction(words("Fine"))}
      ${direction(words("D.C."), '<sound dacapo="yes"/>')}
      ${direction("<direction-type><coda/></direction-type>", '<sound coda="coda"/>')}
      ${note()}
    </measure>
  </part>
</score-partwise>`;

const run = (options: Partial<CleanupOptions> = {}) => {
  const { musicXml, report } = cleanupMusicXmlText(SCORE, options, xml);
  return { musicXml, report, document: xml.parse(musicXml) };
};
const count = (document: Document, name: string) =>
  document.getElementsByTagName(name).length;
const wordsOf = (document: Document) =>
  Array.from(document.getElementsByTagName("words"), (node) => node.textContent);

describe("cleanupMusicXml", () => {
  it("drops credits, titles and creators but keeps the rest of the header", () => {
    const { document, report } = run();
    for (const name of ["credit", "work", "work-title", "movement-title", "creator"]) {
      expect(count(document, name), name).toBe(0);
    }
    expect(count(document, "encoding")).toBe(1);
    expect(count(document, "part-name")).toBe(1);
    expect(report.credits).toEqual([
      "credit: Eva",
      "credit: Fórmula: A - B - A",
      "work: Eva",
      "movement-title: Eva",
      "creator:composer: Banda Eva",
    ]);
  });

  it("drops fingerings, and the elements left empty, but not other notations", () => {
    const { document, report } = run();
    expect(count(document, "fingering")).toBe(0);
    expect(count(document, "up-bow")).toBe(1);
    expect(count(document, "fermata")).toBe(1);
    expect(count(document, "technical")).toBe(1);
    expect(count(document, "notations")).toBe(1);
    expect(count(document, "note")).toBe(3);
    expect(report.parts[0].fingerings).toBe(2);
  });

  it("drops staff text but keeps tempo, jumps, segno/coda, rehearsal, expressions and dynamics", () => {
    const { document, report } = run();
    expect(report.parts[0].staffText).toEqual(["12", "solo"]);
    expect(wordsOf(document)).toEqual([
      "Allegro",
      "dolce",
      "To Coda",
      "D.S. al Coda",
      "Fine",
      "D.C.",
    ]);
    for (const name of ["metronome", "rehearsal", "segno", "coda", "dynamics", "wedge"]) {
      expect(count(document, name), name).toBe(1);
    }
    expect(count(document, "direction")).toBe(12);
  });

  it("switches each rule off on its own", () => {
    const credits = run({ credits: false });
    expect(count(credits.document, "credit")).toBe(2);
    expect(credits.report.credits).toEqual([]);
    const fingerings = run({ fingerings: false });
    expect(count(fingerings.document, "fingering")).toBe(2);
    expect(fingerings.report.parts[0].fingerings).toBe(0);
    const staffText = run({ staffText: false });
    expect(wordsOf(staffText.document)).toContain("solo");
    expect(staffText.report.parts[0].staffText).toEqual([]);
  });

  it("is idempotent", () => {
    const once = run().musicXml;
    expect(cleanupMusicXmlText(once, {}, xml).musicXml).toBe(once);
  });

  it("strips MuseScore's text markup from the words it keeps", () => {
    expect(withoutMarkup('<font size="9.82"></font>D.S. al Coda')).toBe("D.S. al Coda");
    expect(withoutMarkup('<font size="9.82"/>Para \nCoda')).toBe("Para \nCoda");
    expect(withoutMarkup("To <sym>coda</sym>")).toBe("To Coda");
    expect(withoutMarkup("<b>Allegro</b>")).toBe("Allegro");
    const { document } = run();
    expect(wordsOf(document)).toContain("To Coda");
  });
});
