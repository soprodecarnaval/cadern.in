// Piratas: fingerings written into part MusicXML before rendering (ticket
// 008), as the plugin's griffStaff writes them in MuseScore:
// - looked up by sounding pitch (written pitch plus the part's <transpose>);
// - one fingering per chord, on its lowest note;
// - a tied-to note gets none, nor do grace and cue notes;
// - every stem points down;
// - placed above the notes (stems point down, so they stay clear).
// DOM Level 2 only, like cleanup.ts.

export type FingeringReport = {
  /** MusicXML part id. */
  partId: string;
  /** Chords that got a fingering. */
  fingered: number;
  /** Chords whose pitch has no fingering (outside the instrument's table). */
  unfingered: number;
};

const elements = (parent: Node): Element[] =>
  Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1);
const child = (parent: Element, name: string) =>
  elements(parent).find((element) => element.localName === name) ?? null;
const number = (element: Element | null) => {
  const value = Number(element?.textContent?.trim());
  return element && Number.isFinite(value) ? value : 0;
};

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Written MIDI pitch of a <note>, or null for rests and unpitched notes. */
export function writtenMidi(note: Element): number | null {
  const pitch = child(note, "pitch");
  if (!pitch) {return null;}
  const step = STEPS[child(pitch, "step")?.textContent?.trim() ?? ""];
  if (step === undefined) {return null;}
  return (number(child(pitch, "octave")) + 1) * 12 + step + number(child(pitch, "alter"));
}

// <note> children that follow <notations>.
const AFTER_NOTATIONS = ["lyric", "play", "listen"];

const insertBefore = (parent: Element, node: Element, followers: string[]) => {
  const next = elements(parent).find((element) => followers.includes(element.localName));
  parent.insertBefore(node, next ?? null);
};

function setStemDown(note: Element) {
  const stem = child(note, "stem");
  if (stem && stem.textContent?.trim() !== "none") {stem.textContent = "down";}
}

function addFingering(note: Element, text: string) {
  const document = note.ownerDocument;
  let notations = child(note, "notations");
  if (!notations) {
    notations = document.createElement("notations");
    insertBefore(note, notations, AFTER_NOTATIONS);
  }
  let technical = child(notations, "technical");
  if (!technical) {
    technical = document.createElement("technical");
    notations.appendChild(technical);
  }
  const fingering = document.createElement("fingering");
  fingering.setAttribute("placement", "above");
  fingering.textContent = text;
  technical.appendChild(fingering);
}

/**
 * Finger one <part>. `fingeringFor` maps a sounding MIDI pitch to its text
 * ("" for none); make a new one per part (the dynamic trombone picker keeps
 * state).
 */
export function fingerPart(part: Element, fingeringFor: (sounding: number) => string): FingeringReport {
  const report: FingeringReport = { partId: part.getAttribute("id") ?? "", fingered: 0, unfingered: 0 };
  let transpose = 0;
  for (const measure of elements(part).filter((element) => element.localName === "measure")) {
    let chord: Element[] = [];
    const flush = () => {
      const pitched = chord
        .map((note) => ({ note, written: writtenMidi(note) }))
        .filter((entry): entry is { note: Element; written: number } => entry.written !== null);
      chord = [];
      if (!pitched.length || pitched.some(({ note }) => child(note, "grace") || child(note, "cue"))) {return;}
      pitched.forEach(({ note }) => setStemDown(note));
      const lowest = pitched.reduce((low, entry) => (entry.written < low.written ? entry : low));
      if (elements(lowest.note).some((element) => element.localName === "tie" && element.getAttribute("type") === "stop")) {return;}
      const text = fingeringFor(lowest.written + transpose);
      if (text) {
        addFingering(lowest.note, text);
        report.fingered++;
      } else {
        report.unfingered++;
      }
    };
    for (const element of elements(measure)) {
      if (element.localName === "attributes") {
        const interval = child(element, "transpose");
        if (interval) {transpose = number(child(interval, "chromatic")) + 12 * number(child(interval, "octave-change"));}
      }
      if (element.localName !== "note") {
        flush();
        continue;
      }
      if (!child(element, "chord")) {flush();}
      chord.push(element);
    }
    flush();
  }
  return report;
}
