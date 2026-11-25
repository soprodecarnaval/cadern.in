import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { fileInstrument, refiledInstrument, rewritePartInstrument } from "./instrumentXml";
import { correctedMusicXml } from "./renderForUpload";

const parse = (text: string) => new DOMParser().parseFromString(text, "application/xml") as unknown as Document;
const serialize = (document: Document) => new XMLSerializer().serializeToString(document as never);
const codec = { parse, serialize };

// A tenor sax part on a B♭ trumpet staff, as the 2026 template has it (ABRE_ALAS "SAX_TENOR").
const score = (clef = "G", transpose = "<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>") => `<?xml version="1.0"?>
<score-partwise version="3.1"><part-list>
<score-part id="P1"><part-name>Flauta</part-name><score-instrument id="P1-I1"><instrument-name>Flauta</instrument-name></score-instrument></score-part>
<score-part id="P2"><part-name>Bb</part-name><part-abbreviation>Tpt.</part-abbreviation><score-instrument id="P2-I1"><instrument-name>Bb</instrument-name><instrument-sound>brass.trumpet</instrument-sound></score-instrument><midi-instrument id="P2-I1"><midi-channel>2</midi-channel><midi-program>57</midi-program><volume>78</volume></midi-instrument></score-part>
</part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration></note></measure></part>
<part id="P2"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><clef><sign>${clef}</sign><line>2</line></clef>${transpose}</attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration></note></measure>
<measure number="2"><attributes>${transpose}</attributes><note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration></note></measure></part>
</score-partwise>`;

const scorePart = (document: Document, id: string) => Array.from(document.getElementsByTagName("score-part")).find((e) => e.getAttribute("id") === id)!;
const body = (document: Document, id: string) => Array.from(document.getElementsByTagName("part")).find((e) => e.getAttribute("id") === id)!;
const text = (parent: Element, name: string) => Array.from(parent.getElementsByTagName(name)).map((e) => e.textContent);
const transposes = (part: Element) => Array.from(part.getElementsByTagName("transpose")).map((t) =>
  ["diatonic", "chromatic", "octave-change"].map((name) => t.getElementsByTagName(name)[0]?.textContent ?? null));

describe("rewritePartInstrument (025)", () => {
  it("writes the chosen instrument's names, sound, program and one transposition; notes stay", () => {
    const document = parse(score());
    expect(rewritePartInstrument(document, "P2", "sax tenor")).toBe(-14);
    const part = scorePart(document, "P2");
    expect(text(part, "part-name")).toEqual(["Sax tenor"]);
    expect(text(part, "part-abbreviation")).toEqual(["Sax. T."]);
    expect(text(part, "instrument-name")).toEqual(["Sax tenor"]);
    expect(text(part, "instrument-sound")).toEqual(["wind.reed.saxophone.tenor"]);
    expect(text(part, "midi-program")).toEqual(["67"]);
    expect(transposes(body(document, "P2"))).toEqual([["-1", "-2", "-1"]]);
    expect(text(body(document, "P2"), "step")).toEqual(["C", "D"]);
    // <transpose> after <clef>, as the schema orders <attributes>.
    const attributes = body(document, "P2").getElementsByTagName("attributes")[0];
    expect(Array.from(attributes.childNodes).map((node) => (node as Element).localName)).toEqual(["divisions", "key", "clef", "transpose"]);
    // The other part is untouched.
    expect(text(scorePart(document, "P1"), "part-name")).toEqual(["Flauta"]);
  });

  it("adds a missing sound, and transposes brass by clef", () => {
    const bass = parse(score("F", ""));
    expect(rewritePartInstrument(bass, "P2", "trombone pirata")).toBe(0);
    expect(transposes(body(bass, "P2"))).toEqual([]);
    expect(text(scorePart(bass, "P2"), "midi-program")).toEqual(["58"]);
    const treble = parse(score("G"));
    expect(rewritePartInstrument(treble, "P2", "trombone")).toBe(-14);
    expect(rewritePartInstrument(treble, "P2", "tuba eb")).toBe(-33);
    expect(transposes(body(treble, "P2"))).toEqual([["-5", "-9", "-2"]]);
    const flute = parse(score("G", ""));
    rewritePartInstrument(flute, "P1", "sax alto");
    expect(text(scorePart(flute, "P1"), "instrument-sound")).toEqual(["wind.reed.saxophone.alto"]);
  });

  it("leaves an unknown part id alone", () => {
    expect(rewritePartInstrument(parse(score()), "P9", "flauta")).toBeNull();
  });
});

describe("refiledInstrument", () => {
  const trumpetStaff = { name: "SAX TENOR", instruments: [{ id: "", soundId: "brass.trumpet", longName: "Bb", shortName: "" }] };
  it("rewrites only parts filed under another family than their staff's", () => {
    expect(fileInstrument(trumpetStaff)).toBe("trompete");
    expect(refiledInstrument(trumpetStaff, "sax tenor")).toBe("sax tenor");
    expect(refiledInstrument(trumpetStaff, "trompete pirata")).toBeNull();
    expect(refiledInstrument(trumpetStaff, "trombone pirata")).toBe("trombone");
    expect(refiledInstrument(trumpetStaff, null)).toBeNull();
    const ebTuba = { name: "TUBA", instruments: [{ id: "eb-tuba", soundId: null, longName: "E♭ Tuba", shortName: "" }] };
    expect(refiledInstrument(ebTuba, "tuba")).toBeNull();
    // An instrument cadern.in does not know is written as the chosen one.
    const winds = { name: "FLAUTA", instruments: [{ id: "", soundId: "wind.group", longName: "Flute", shortName: "" }] };
    expect(refiledInstrument(winds, "flauta")).toBe("flauta");
    expect(refiledInstrument({ ...trumpetStaff, instruments: [...trumpetStaff.instruments, ...trumpetStaff.instruments] }, "sax tenor")).toBeNull();
  });
});

describe("correctedMusicXml", () => {
  const exported = { musicXml: score(), parts: [
    { id: "P1", name: "Flauta", instrumentNames: [], transposeChromatic: null, catalogPart: { id: "a", name: "FLAUTA", origin: "existing" as const } },
    { id: "P2", name: "Bb", instrumentNames: [], transposeChromatic: -2, catalogPart: { id: "b", name: "SAX TENOR", origin: "existing" as const } },
  ] };
  it("rewrites the parts filed under another instrument, by the export's part mapping", () => {
    const document = parse(correctedMusicXml(exported, [{ partId: "a", instrument: null }, { partId: "b", instrument: "sax tenor" }], codec));
    expect(text(scorePart(document, "P2"), "part-name")).toEqual(["Sax tenor"]);
    expect(text(scorePart(document, "P1"), "part-name")).toEqual(["Flauta"]);
  });
  it("returns the engine's file when nothing was refiled", () => {
    expect(correctedMusicXml(exported, [{ partId: "a", instrument: null }], codec)).toBe(exported.musicXml);
  });
});
