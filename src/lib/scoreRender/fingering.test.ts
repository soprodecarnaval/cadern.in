import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATTING_PROFILE, zFormattingProfile } from "../../../types/formattingProfile";
import { fingerPart, writtenMidi } from "./fingering";
import { transformPartMusicXml, type XmlCodec } from "./partTransform";

const codec: XmlCodec = {
  parse: (text) => new DOMParser().parseFromString(text, "application/xml") as unknown as Document,
  serialize: (document) =>
    new XMLSerializer().serializeToString(document as unknown as Parameters<XMLSerializer["serializeToString"]>[0]),
};

const note = (step: string, octave: number, extra = "", before = "") =>
  `<note>${before}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration>${extra}<type>quarter</type><stem>up</stem></note>`;

// A Bb trumpet part: written pitch, transposed down a major second.
const PART = `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Trompete</part-name></score-part></part-list>
<part id="P1">
  <measure number="1">
    <attributes><divisions>1</divisions><transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>
    ${note("C", 4)}
    ${note("E", 4)}${note("C", 4, "", "<chord/>")}
    ${note("D", 4, '<tie type="start"/>')}
    ${note("D", 4, '<tie type="stop"/>')}
  </measure>
  <measure number="2">
    ${note("G", 4, "", "<grace/>")}
    <note><rest/><duration>1</duration><type>quarter</type></note>
    ${note("C", 7)}
    <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><stem>up</stem><notations><articulations><staccato/></articulations></notations><lyric><text>la</text></lyric></note>
  </measure>
</part></score-partwise>`;

const fingeringsOf = (document: Document) =>
  Array.from(document.getElementsByTagName("note"), (n) => n.getElementsByTagName("fingering")[0]?.textContent ?? null);

describe("fingerPart", () => {
  it("reads written pitch", () => {
    const document = codec.parse(PART);
    expect(writtenMidi(document.getElementsByTagName("note")[0])).toBe(60);
  });

  it("fingers the lowest note of each chord by sounding pitch, skipping ties, grace notes and rests", () => {
    const document = codec.parse(PART);
    const asked: number[] = [];
    const report = fingerPart(document.getElementsByTagName("part")[0], (sounding) => {
      asked.push(sounding);
      return sounding > 90 ? "" : `p${sounding}`;
    });
    // Written C4 sounds Bb3 (58) on a Bb trumpet.
    expect(asked).toEqual([58, 58, 60, 94, 63]);
    expect(fingeringsOf(document)).toEqual(["p58", null, "p58", "p60", null, null, null, null, "p63"]);
    expect(report).toEqual({ partId: "P1", fingered: 4, unfingered: 1 });
  });

  it("points every stem of the part down, grace notes aside, and keeps the element order", () => {
    const document = codec.parse(PART);
    fingerPart(document.getElementsByTagName("part")[0], () => "1");
    const stems = Array.from(document.getElementsByTagName("stem"), (stem) => stem.textContent);
    expect(stems).toEqual(["down", "down", "down", "down", "down", "up", "down", "down"]);
    const last = Array.from(document.getElementsByTagName("note")).at(-1)!;
    const order = Array.from(last.childNodes).filter((n) => n.nodeType === 1).map((n) => (n as Element).localName);
    expect(order).toEqual(["pitch", "duration", "type", "stem", "notations", "lyric"]);
    const notations = last.getElementsByTagName("notations")[0];
    expect(notations.getElementsByTagName("staccato")).toHaveLength(1);
    expect(notations.getElementsByTagName("fingering")[0].getAttribute("placement")).toBe("above");
  });
});

describe("transformPartMusicXml", () => {
  const trumpet = { ordinal: 1, name: "Trompete", instruments: [{ id: "bb-trumpet", soundId: "brass.trumpet.bflat", longName: "Trompete", shortName: "Tpt." }] };
  const flute = { ordinal: 2, name: "Flauta", instruments: [{ id: "flute", soundId: "wind.flutes.flute", longName: "Flauta", shortName: "Fl." }] };

  it("gives pirata parts positions by default, and others nothing", () => {
    const { musicXml, report } = transformPartMusicXml(PART, trumpet, DEFAULT_FORMATTING_PROFILE, codec);
    // Written C4 is open (position 1), D4 is 1-3 (6), F4 is 1 (3).
    expect(fingeringsOf(codec.parse(musicXml))).toEqual(["1", null, "1", "6", null, null, null, null, "3"]);
    expect(report.fingerings[0].fingered).toBe(4);
    const plain = transformPartMusicXml(PART, flute, DEFAULT_FORMATTING_PROFILE, codec);
    expect(plain.report.fingerings).toEqual([]);
    expect(fingeringsOf(codec.parse(plain.musicXml)).every((f) => f === null)).toBe(true);
  });

  it("follows the profile: valves, and fingerings off for one part", () => {
    const profile = zFormattingProfile.parse({ profileVersion: 1, fingering: { notation: "valves" }, parts: { Outro: { fingering: { enabled: false } } } });
    const valves = transformPartMusicXml(PART, trumpet, profile, codec);
    expect(fingeringsOf(codec.parse(valves.musicXml))).toEqual(["0", null, "0", "13", null, null, null, null, "1"]);
    const off = transformPartMusicXml(PART, { ...trumpet, name: "Outro" }, profile, codec);
    expect(off.report.fingerings).toEqual([]);
  });

  it("formats a part as the instrument it is filed under, whatever the file declares", () => {
    const asTrumpet = transformPartMusicXml(PART, flute, DEFAULT_FORMATTING_PROFILE, codec, "trompete pirata");
    expect(fingeringsOf(codec.parse(asTrumpet.musicXml))).toEqual(["1", null, "1", "6", null, null, null, null, "3"]);
    const asFlute = transformPartMusicXml(PART, trumpet, DEFAULT_FORMATTING_PROFILE, codec, "flauta");
    expect(asFlute.report.fingerings).toEqual([]);
    // The written notes are left as they are.
    const pitches = (xml: string) => [...xml.matchAll(/<step>(\w)<\/step>/g)].map((m) => m[1]);
    expect(pitches(asTrumpet.musicXml)).toEqual(pitches(PART));
  });
});
