// Tuba notation (ticket 009), as plugin/tubaNotation.js writes it in
// MuseScore, on part MusicXML:
// - concert-octave (Bb/Eb tuba and sousaphone at concert pitch): F clef an
//   octave down (F8vb). MusicXML pitches stay as they are; the clef's
//   octave change draws them an octave higher on the staff.
// - transposed-treble: G clef with the instrument's own transposition
//   (−26 Bb, −21 Eb). A customized transposition is reset: notes and key are
//   re-spelled in the written key.
// - transposed-bass: left alone.
// Sounding pitch never changes, so fingerings (looked up by sounding pitch)
// and MIDI are unaffected. DOM Level 2 only, like cleanup.ts.
import type { TubaPolicy } from "../instruments";

export type TubaNotationReport = {
  partId: string;
  mode: TubaPolicy["mode"];
  clefs: number;
  /** Notes re-spelled because the transposition was reset. */
  respelled: number;
};

type Interval = { diatonic: number; chromatic: number };

const elements = (parent: Node): Element[] =>
  Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1);
const child = (parent: Element, name: string) =>
  elements(parent).find((element) => element.localName === name) ?? null;
const named = (parent: Element, name: string) =>
  elements(parent).filter((element) => element.localName === name);
const number = (element: Element | null) => {
  const value = Number(element?.textContent?.trim());
  return element && Number.isFinite(value) ? value : 0;
};
const create = (parent: Element, name: string, text?: string | number) => {
  const element = parent.ownerDocument.createElement(name);
  if (text !== undefined) {element.textContent = String(text);}
  parent.appendChild(element);
  return element;
};
const clear = (element: Element) => {
  while (element.firstChild) {element.removeChild(element.firstChild);}
};

const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const mod = (value: number, base: number) => ((value % base) + base) % base;

/** Written→sounding interval the policy's notation uses (MusicXML <transpose>, totals). */
export function policyInterval(policy: TubaPolicy): Interval | null {
  if (policy.mode === "concert-octave") {return { diatonic: 0, chromatic: 0 };}
  if (policy.mode === "transposed-bass") {return null;}
  // A major ninth plus an octave (Bb), a major sixth plus an octave (Eb).
  return policy.tuning === "Bb" ? { diatonic: -15, chromatic: -26 } : { diatonic: -12, chromatic: -21 };
}

const intervalOf = (transpose: Element | null): Interval => ({
  diatonic: number(transpose && child(transpose, "diatonic")) + 7 * number(transpose && child(transpose, "octave-change")),
  chromatic: number(transpose && child(transpose, "chromatic")) + 12 * number(transpose && child(transpose, "octave-change")),
});

function writeTranspose(transpose: Element, interval: Interval) {
  clear(transpose);
  const octaves = Math.trunc(interval.chromatic / 12);
  create(transpose, "diatonic", interval.diatonic - 7 * octaves);
  create(transpose, "chromatic", interval.chromatic - 12 * octaves);
  if (octaves) {create(transpose, "octave-change", octaves);}
}

function writeClef(clef: Element, mode: TubaPolicy["mode"]) {
  const number = clef.getAttribute("number");
  clear(clef);
  for (const attribute of Array.from(clef.attributes)) {clef.removeAttribute(attribute.name);}
  if (number) {clef.setAttribute("number", number);}
  if (mode === "concert-octave") {
    create(clef, "sign", "F");
    create(clef, "line", 4);
    create(clef, "clef-octave-change", -1);
  } else {
    create(clef, "sign", "G");
    create(clef, "line", 2);
  }
}

/** A key's fifths moved by a chromatic shift (in written pitch), kept within ±7. */
const shiftFifths = (fifths: number, chromatic: number) => {
  let result = fifths + mod(7 * chromatic, 12);
  while (result > 7) {result -= 12;}
  while (result < -7) {result += 12;}
  return result;
};

/** Alteration of each step under a key signature. */
const keyAlterations = (fifths: number): number[] => {
  const alterations = [0, 0, 0, 0, 0, 0, 0];
  const sharps = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
  for (let i = 0; i < Math.abs(fifths); i++) {
    alterations[fifths > 0 ? sharps[i] : sharps[6 - i]] = fifths > 0 ? 1 : -1;
  }
  return alterations;
};

const ACCIDENTALS: Record<number, string> = { [-2]: "flat-flat", [-1]: "flat", 0: "natural", 1: "sharp", 2: "double-sharp" };
// <note> children that follow <accidental>.
const AFTER_ACCIDENTAL = ["time-modification", "stem", "notehead", "notehead-text", "staff", "beam", "notations", "lyric", "play", "listen"];

/** Re-spell every note of the part by `shift` (written pitches move, sounding stays), with accidentals. */
function respell(part: Element, shift: Interval): number {
  let count = 0;
  let fifths = 0;
  for (const measure of named(part, "measure")) {
    for (const attributes of named(measure, "attributes")) {
      for (const key of named(attributes, "key")) {
        const element = child(key, "fifths");
        if (element) {element.textContent = String((fifths = shiftFifths(number(element), shift.chromatic)));}
      }
    }
    const key = keyAlterations(fifths);
    const state = new Map<string, number>();
    for (const note of named(measure, "note")) {
      const pitch = child(note, "pitch");
      if (!pitch) {continue;}
      const step = STEPS.indexOf(child(pitch, "step")?.textContent?.trim() ?? "");
      if (step < 0) {continue;}
      const octave = number(child(pitch, "octave"));
      const midi = (octave + 1) * 12 + NATURAL[step] + number(child(pitch, "alter"));
      const index = step + 7 * octave + shift.diatonic;
      const newStep = mod(index, 7);
      const newOctave = Math.floor(index / 7);
      const alter = midi + shift.chromatic - ((newOctave + 1) * 12 + NATURAL[newStep]);
      clear(pitch);
      create(pitch, "step", STEPS[newStep]);
      if (alter) {create(pitch, "alter", alter);}
      create(pitch, "octave", newOctave);
      count++;
      // Accidentals: shown when the alteration differs from what is in effect.
      const slot = `${newStep}:${newOctave}`;
      const current = state.get(slot) ?? key[newStep];
      const tied = elements(note).some((e) => e.localName === "tie" && e.getAttribute("type") === "stop");
      const old = child(note, "accidental");
      if (old) {note.removeChild(old);}
      if (alter !== current && !tied && ACCIDENTALS[alter]) {
        const accidental = note.ownerDocument.createElement("accidental");
        accidental.textContent = ACCIDENTALS[alter];
        const next = elements(note).find((e) => AFTER_ACCIDENTAL.includes(e.localName));
        note.insertBefore(accidental, next ?? null);
      }
      state.set(slot, alter);
    }
  }
  return count;
}

/** Apply a tuba policy to one <part>. Returns null when the policy leaves it alone. */
export function applyTubaNotation(part: Element, policy: TubaPolicy): TubaNotationReport | null {
  const target = policyInterval(policy);
  if (!target) {return null;}
  const report: TubaNotationReport = { partId: part.getAttribute("id") ?? "", mode: policy.mode, clefs: 0, respelled: 0 };
  const allAttributes = named(part, "measure").flatMap((measure) => named(measure, "attributes"));
  const firstTranspose = allAttributes.map((attributes) => child(attributes, "transpose")).find(Boolean) ?? null;
  const current = intervalOf(firstTranspose);
  if (current.chromatic !== target.chromatic || current.diatonic !== target.diatonic) {
    // written + current = sounding = written' + target
    report.respelled = respell(part, {
      diatonic: current.diatonic - target.diatonic,
      chromatic: current.chromatic - target.chromatic,
    });
  }
  for (const attributes of allAttributes) {
    for (const transpose of named(attributes, "transpose")) {attributes.removeChild(transpose);}
    for (const clef of named(attributes, "clef")) {
      writeClef(clef, policy.mode);
      report.clefs++;
    }
  }
  const first = allAttributes[0];
  if (first && !child(first, "clef")) {
    // A part without an initial clef gets one, as the plugin adds it.
    const clef = first.ownerDocument.createElement("clef");
    writeClef(clef, policy.mode);
    const next = elements(first).find((e) => ["staff-details", "transpose", "for-part", "directive", "measure-style"].includes(e.localName));
    first.insertBefore(clef, next ?? null);
    report.clefs++;
  }
  if (first && (target.chromatic || target.diatonic)) {
    // <transpose> follows key, time, staves, part-symbol, instruments and clef.
    const transpose = first.ownerDocument.createElement("transpose");
    writeTranspose(transpose, target);
    const next = elements(first).find((e) => ["for-part", "directive", "measure-style"].includes(e.localName));
    first.insertBefore(transpose, next ?? null);
  }
  return report;
}
