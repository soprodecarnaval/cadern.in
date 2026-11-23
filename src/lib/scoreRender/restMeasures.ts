// Narrow rest measures: a measure in which a part rests the whole time keeps
// its own bar and whole rest, but is drawn about as wide as a measure with one
// beat of music instead of the full measure's time. Verovio spaces measures by
// duration, so the drawing copy gives the rest one beat (MIDI comes from the
// original file, not from this MusicXML). DOM Level 2 only, like cleanup.ts.

export type RestMeasuresReport = { partId: string; narrowed: number[] };

const elements = (parent: Node): Element[] =>
  Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1);
const named = (parent: Element, name: string) => elements(parent).filter((element) => element.localName === name);
const create = (document: Document, name: string, text: string) => {
  const element = document.createElement(name);
  element.textContent = text;
  return element;
};

/** The note of a measure that holds one whole-measure rest and nothing else, or null. */
function wholeMeasureRest(measure: Element): Element | null {
  const children = elements(measure);
  const notes = children.filter((child) => child.localName === "note");
  if (notes.length !== 1 || children.some((child) => child.localName === "backup" || child.localName === "forward")) {return null;}
  const rest = named(notes[0], "rest")[0];
  if (!rest || named(notes[0], "cue").length) {return null;}
  // MusicXML marks it measure="yes"; some files write a rest without a note type instead.
  return rest.getAttribute("measure") === "yes" || named(notes[0], "type").length === 0 ? notes[0] : null;
}

/** Narrows every whole-measure rest of a part, in place. Multi-staff parts are left alone. */
export function narrowRestMeasures(part: Element): RestMeasuresReport {
  const report: RestMeasuresReport = { partId: part.getAttribute("id") ?? "", narrowed: [] };
  if (Array.from(part.getElementsByTagName("staves")).some((staves) => Number(staves.textContent) > 1)) {return report;}
  let divisions = 1;
  named(part, "measure").forEach((measure, index) => {
    for (const attributes of named(measure, "attributes")) {
      const value = Number(named(attributes, "divisions")[0]?.textContent);
      if (value > 0) {divisions = value;}
    }
    const note = wholeMeasureRest(measure);
    if (!note) {return;}
    const document = part.ownerDocument;
    const rest = named(note, "rest")[0];
    rest.removeAttribute("measure");
    const duration = named(note, "duration")[0];
    if (duration) {duration.textContent = String(divisions);}
    // A whole rest symbol, placed where MusicXML wants <type>: after voice (or duration).
    for (const old of named(note, "type")) {note.removeChild(old);}
    const after = named(note, "voice")[0] ?? duration ?? rest;
    note.insertBefore(create(document, "type", "whole"), after.nextSibling);
    report.narrowed.push(index);
  });
  return report;
}
