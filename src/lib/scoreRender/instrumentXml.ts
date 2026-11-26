// The instrument a part is filed under, written into its MusicXML (ticket 025). Arrangers reuse
// staves (a tenor sax part on a trumpet staff); when the part is filed under another instrument
// family than its staff's (024), its MusicXML names, sound, MIDI program and transposition are
// rewritten to that instrument. The written notes stay as they are, so the sounding pitch (and
// with it playback and fingerings) follows the instrument the part is really for.
import type { Part } from "../browserScore/types";
import type { Instrument } from "../../../types/instrument";
import { baseInstrument, mapInstrumentId, sameInstrumentFamily } from "../instruments";

type ClefSign = string | null;
type MusicXmlInstrument = {
  name: string;
  abbreviation: string;
  /** MusicXML standard sound (`instrument-sound`). */
  sound: string;
  /** General MIDI program, 1–128 as MusicXML counts. */
  program: number;
  /** Semitones from written to sounding pitch, by the part's first clef. */
  transpose: (clef: ClefSign) => number;
};

// Brass in bass clef sound as written; in treble clef they are written as B♭ (or E♭) instruments.
const brass = (treble: number) => (clef: ClefSign) => (clef === "G" ? treble : 0);
const TABLE: Readonly<Record<Instrument, MusicXmlInstrument | undefined>> = {
  flauta: { name: "Flauta", abbreviation: "Fl.", sound: "wind.flutes.flute", program: 74, transpose: () => 0 },
  clarinete: { name: "Clarinete em B♭", abbreviation: "Cl.", sound: "wind.reed.clarinet.bflat", program: 72, transpose: () => -2 },
  "sax soprano": { name: "Sax soprano", abbreviation: "Sax. S.", sound: "wind.reed.saxophone.soprano", program: 65, transpose: () => -2 },
  "sax alto": { name: "Sax alto", abbreviation: "Sax. A.", sound: "wind.reed.saxophone.alto", program: 66, transpose: () => -9 },
  "sax tenor": { name: "Sax tenor", abbreviation: "Sax. T.", sound: "wind.reed.saxophone.tenor", program: 67, transpose: () => -14 },
  "sax baritono": { name: "Sax barítono", abbreviation: "Sax. B.", sound: "wind.reed.saxophone.baritone", program: 68, transpose: () => -21 },
  trompete: { name: "Trompete em B♭", abbreviation: "Tpt.", sound: "brass.trumpet.bflat", program: 57, transpose: () => -2 },
  trombone: { name: "Trombone", abbreviation: "Tbn.", sound: "brass.trombone", program: 58, transpose: brass(-14) },
  bombardino: { name: "Bombardino", abbreviation: "Bomb.", sound: "brass.euphonium", program: 59, transpose: brass(-14) },
  tuba: { name: "Tuba", abbreviation: "Tba.", sound: "brass.tuba", program: 59, transpose: brass(-26) },
  "tuba eb": { name: "Tuba em E♭", abbreviation: "Tba. E♭", sound: "brass.tuba", program: 59, transpose: brass(-33) },
  "trompete pirata": undefined,
  "trombone pirata": undefined,
};

/** The MusicXML instrument data of a cadern.in instrument (a pirata as its plain instrument). */
export const musicXmlInstrument = (instrument: Instrument): MusicXmlInstrument => TABLE[baseInstrument(instrument)]!;

/** The cadern.in instrument the part's own MuseScore instrument maps to, if any. */
export function fileInstrument(part: Pick<Part, "instruments" | "name">): Instrument | null {
  const first = part.instruments[0];
  if (!first) {return null;}
  const names = [part.name, first.longName, first.shortName];
  return (first.id ? mapInstrumentId(first.id, names) : null) ?? (first.soundId ? mapInstrumentId(first.soundId, names) : null);
}

/**
 * The instrument to write into the part's MusicXML, or null to leave it: the chosen instrument
 * when it is another family than the file's (or the file's is unknown). Parts that change
 * instrument are left alone.
 */
export function refiledInstrument(part: Pick<Part, "instruments" | "name">, chosen: Instrument | null | undefined): Instrument | null {
  if (!chosen || part.instruments.length !== 1) {return null;}
  const own = fileInstrument(part);
  return own && sameInstrumentFamily(own, chosen) ? null : baseInstrument(chosen);
}

const childElements = (parent: Element, name?: string): Element[] =>
  Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1 && (!name || (node as Element).localName === name));
const child = (parent: Element, name: string): Element | undefined => childElements(parent, name)[0];
function ensureChild(parent: Element, name: string, before: readonly string[] = []): Element {
  const existing = child(parent, name);
  if (existing) {return existing;}
  const created = parent.ownerDocument.createElement(name);
  const next = childElements(parent).find((element) => before.includes(element.localName));
  parent.insertBefore(created, next ?? null);
  return created;
}
const setText = (element: Element, text: string) => {
  while (element.firstChild) {element.removeChild(element.firstChild);}
  element.appendChild(element.ownerDocument.createTextNode(text));
};

// <attributes> children that come after <transpose> in the MusicXML schema.
const AFTER_TRANSPOSE = ["for-part", "directive", "measure-style"];
// Diatonic steps of a descending interval within an octave, by semitones (the usual spellings).
const DIATONIC: Readonly<Record<number, number>> = { 0: 0, [-1]: -1, [-2]: -1, [-3]: -2, [-4]: -2, [-5]: -3, [-6]: -4, [-7]: -4, [-8]: -5, [-9]: -5, [-10]: -6, [-11]: -6 };

/** The first clef sign of a part body (`G`, `F`, `C`, …), or null. */
function firstClef(body: Element): ClefSign {
  for (const clef of Array.from(body.getElementsByTagName("clef"))) {
    const sign = child(clef, "sign")?.textContent?.trim();
    if (sign) {return sign;}
  }
  return null;
}

/**
 * Rewrite one part of a MusicXML document (part `<score-part>` and body with the same id) as
 * `instrument`: part and instrument names, sound, MIDI program and transposition. Returns the
 * transposition written (semitones).
 */
export function rewritePartInstrument(document: Document, partId: string, instrument: Instrument): number | null {
  const data = musicXmlInstrument(instrument);
  const root = document.documentElement;
  const scorePart = Array.from(root.getElementsByTagName("score-part")).find((element) => element.getAttribute("id") === partId);
  const body = childElements(root, "part").find((element) => element.getAttribute("id") === partId);
  if (!scorePart || !body) {return null;}

  setText(ensureChild(scorePart, "part-name", ["part-name-display", "part-abbreviation", "part-abbreviation-display", "group", "score-instrument", "player", "midi-device", "midi-instrument"]), data.name);
  const abbreviation = child(scorePart, "part-abbreviation");
  if (abbreviation) {setText(abbreviation, data.abbreviation);}
  for (const element of childElements(scorePart, "score-instrument")) {
    setText(ensureChild(element, "instrument-name"), data.name);
    const abbreviated = child(element, "instrument-abbreviation");
    if (abbreviated) {setText(abbreviated, data.abbreviation);}
    setText(ensureChild(element, "instrument-sound", ["solo", "ensemble", "virtual-instrument"]), data.sound);
  }
  for (const element of childElements(scorePart, "midi-instrument")) {
    setText(ensureChild(element, "midi-program", ["midi-unpitched", "volume", "pan", "elevation"]), String(data.program));
  }

  // One transposition for the whole part, in its first <attributes>; any other is dropped.
  const semitones = data.transpose(firstClef(body));
  for (const transpose of Array.from(body.getElementsByTagName("transpose"))) {transpose.parentNode?.removeChild(transpose);}
  const firstMeasure = child(body, "measure");
  if (semitones !== 0 && firstMeasure) {
    const attributes = ensureChild(firstMeasure, "attributes", ["note", "backup", "forward", "direction", "harmony", "figured-bass", "print", "sound", "listening", "barline", "grouping", "link", "bookmark"]);
    const octaves = Math.trunc(semitones / 12);
    const chromatic = semitones - 12 * octaves;
    const transpose = document.createElement("transpose");
    const add = (name: string, value: number) => {
      const element = document.createElement(name);
      element.appendChild(document.createTextNode(String(value)));
      transpose.appendChild(element);
    };
    add("diatonic", DIATONIC[chromatic] ?? 0);
    add("chromatic", chromatic);
    if (octaves) {add("octave-change", octaves);}
    const next = childElements(attributes).find((element) => AFTER_TRANSPOSE.includes(element.localName));
    attributes.insertBefore(transpose, next ?? null);
  }
  return semitones;
}
