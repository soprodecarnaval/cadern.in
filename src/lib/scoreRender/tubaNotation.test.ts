// Fixture: the first 12 measures of each tuba part of
// test-scores/all-instruments.mscz, as the browser-score library extracts and
// cleans them (scripts/browserScore/partPages.mjs, PART_PAGES_CLEANUP=1).
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATTING_PROFILE } from "../../../types/formattingProfile";
import { instrumentSettings, type TubaPolicy } from "../instruments";
import tubas from "./fixtures/allInstrumentsTubas.json";
import { writtenMidi } from "./fingering";
import { transformPartMusicXml, type XmlCodec } from "./partTransform";
import { applyTubaNotation } from "./tubaNotation";

const codec: XmlCodec = {
  parse: (text) => new DOMParser().parseFromString(text, "application/xml") as unknown as Document,
  serialize: (document) => new XMLSerializer().serializeToString(document as never),
};
type Fixture = (typeof tubas)[keyof typeof tubas];
const fixture = (id: keyof typeof tubas): Fixture => tubas[id];
const partOf = (xml: string) => codec.parse(xml).getElementsByTagName("part")[0];
const total = (part: Element) => {
  const t = part.getElementsByTagName("transpose")[0];
  const n = (name: string) => Number(t?.getElementsByTagName(name)[0]?.textContent ?? 0);
  return { chromatic: n("chromatic") + 12 * n("octave-change"), diatonic: n("diatonic") + 7 * n("octave-change") };
};
const written = (part: Element) => Array.from(part.getElementsByTagName("note")).map(writtenMidi);
const sounding = (part: Element) => written(part).map((midi) => (midi === null ? null : midi + total(part).chromatic));
const spelling = (part: Element) =>
  Array.from(part.getElementsByTagName("pitch")).map((pitch) =>
    ["step", "alter", "octave"].map((name) => pitch.getElementsByTagName(name)[0]?.textContent ?? "").join(""),
  );
const clefs = (part: Element) =>
  Array.from(part.getElementsByTagName("clef")).map((clef) =>
    ["sign", "line", "clef-octave-change"].map((name) => clef.getElementsByTagName(name)[0]?.textContent ?? "").join(""),
  );
/** Notes whose drawn alteration (key, earlier accidentals in the measure, own accidental) differs from their pitch. */
const accidentalErrors = (part: Element) => {
  const values: Record<string, number> = { "flat-flat": -2, flat: -1, natural: 0, sharp: 1, "double-sharp": 2 };
  const errors: string[] = [];
  let key = [0, 0, 0, 0, 0, 0, 0];
  Array.from(part.getElementsByTagName("measure")).forEach((measure, index) => {
    const fifths = measure.getElementsByTagName("fifths")[0];
    if (fifths) {
      const f = Number(fifths.textContent);
      key = [0, 0, 0, 0, 0, 0, 0];
      const order = [3, 0, 4, 1, 5, 2, 6];
      for (let i = 0; i < Math.abs(f); i++) {key[f > 0 ? order[i] : order[6 - i]] = f > 0 ? 1 : -1;}
    }
    const state = new Map<string, number>();
    for (const note of Array.from(measure.getElementsByTagName("note"))) {
      const pitch = note.getElementsByTagName("pitch")[0];
      if (!pitch) {continue;}
      const step = "CDEFGAB".indexOf(pitch.getElementsByTagName("step")[0].textContent!);
      const slot = `${step}:${pitch.getElementsByTagName("octave")[0].textContent ?? ""}`;
      const alter = Number(pitch.getElementsByTagName("alter")[0]?.textContent ?? 0);
      const shown = note.getElementsByTagName("accidental")[0]?.textContent;
      const tied = Array.from(note.getElementsByTagName("tie")).some((t) => t.getAttribute("type") === "stop");
      const drawn = shown ? values[shown] : state.get(slot) ?? key[step];
      if (drawn !== alter && !tied) {errors.push(`m${index + 1} ${slot} ${alter} drawn ${drawn}`);}
      state.set(slot, alter);
    }
  });
  return errors;
};
const policy = (id: string) => instrumentSettings(id)!.tubaPolicy!;

describe("tuba notation on all-instruments.mscz", () => {
  it.each(["bass-eb-tuba", "bb-tuba", "sousaphone"] as const)("writes %s in F8vb at concert pitch", (id) => {
    const part = partOf(fixture(id).musicXml);
    const before = spelling(part);
    const report = applyTubaNotation(part, policy(id));
    expect(clefs(part).every((clef) => clef === "F4-1")).toBe(true);
    expect(report?.clefs).toBeGreaterThan(0);
    expect(spelling(part)).toEqual(before);
    expect(total(part)).toEqual({ chromatic: 0, diatonic: 0 });
  });

  it.each(["eb-tuba-treble", "bb-tuba-treble", "bb-sousaphone-treble"] as const)("keeps %s in treble clef at its own transposition", (id) => {
    const part = partOf(fixture(id).musicXml);
    const before = spelling(part);
    const report = applyTubaNotation(part, policy(id));
    expect(clefs(part).every((clef) => clef === "G2")).toBe(true);
    expect(report?.respelled).toBe(0);
    expect(spelling(part)).toEqual(before);
    expect(total(part).chromatic).toBe(id === "eb-tuba-treble" ? -21 : -26);
  });

  it("leaves the transposed bass-clef sousaphone alone", () => {
    const part = partOf(fixture("bb-sousaphone").musicXml);
    const before = codec.serialize(part.ownerDocument);
    expect(applyTubaNotation(part, policy("bb-sousaphone"))).toBeNull();
    expect(codec.serialize(part.ownerDocument)).toBe(before);
  });

  // The concert and treble parts of the test score hold the same music, so a
  // reset transposition must give exactly the treble part's written notes.
  it.each([
    ["bass-eb-tuba", "eb-tuba-treble"],
    ["bb-tuba", "bb-tuba-treble"],
  ] as const)("re-spells %s like %s when its transposition is reset", (concert, treble) => {
    const part = partOf(fixture(concert).musicXml);
    const sound = sounding(part);
    const report = applyTubaNotation(part, { ...policy(treble) } as TubaPolicy);
    const expected = partOf(fixture(treble).musicXml);
    expect(report?.respelled).toBeGreaterThan(0);
    expect(spelling(part)).toEqual(spelling(expected));
    expect(sounding(part)).toEqual(sound);
    expect(clefs(part)).toEqual(clefs(expected));
    // The test score has no key (C, open), so its treble parts carry none
    // either; a reset moves the key like the notes: Eb +3 fifths, Bb +2.
    const fifths = Array.from(part.getElementsByTagName("fifths"), (f) => f.textContent);
    expect(new Set(fifths)).toEqual(new Set([treble === "eb-tuba-treble" ? "3" : "2"]));
    expect(accidentalErrors(part)).toEqual([]);
  });

  it("runs before fingerings, which keep the sounding pitch", () => {
    const fx = fixture("bb-tuba");
    const plain = transformPartMusicXml(fx.musicXml, fx, DEFAULT_FORMATTING_PROFILE, codec);
    expect(plain.report.tubaNotation).toHaveLength(1);
    const fingers = (xml: string) => Array.from(codec.parse(xml).getElementsByTagName("fingering"), (f) => f.textContent);
    const treble = fixture("bb-tuba-treble");
    const asTreble = transformPartMusicXml(treble.musicXml, treble, DEFAULT_FORMATTING_PROFILE, codec);
    expect(fingers(plain.musicXml)).toEqual(fingers(asTreble.musicXml));
    expect(fingers(plain.musicXml).length).toBeGreaterThan(10);
  });

  it("skips parts with instrument changes", () => {
    const fx = fixture("bb-tuba");
    const result = transformPartMusicXml(fx.musicXml, { ...fx, instruments: [...fx.instruments, ...fx.instruments] }, DEFAULT_FORMATTING_PROFILE, codec);
    expect(result.report.tubaNotationSkipped).toBe("instrument-changes");
    expect(result.report.tubaNotation).toEqual([]);
  });
});
