// Multi-measure rests: a run of measures where the part rests the whole measure is drawn
// as one short measure with the count over it, as MuseScore parts do,
// instead of a full-width measure each. DOM Level 2 only, like cleanup.ts.
//
// A run breaks wherever a player needs to see something: a clef, key or time
// change, a marking (rehearsal, tempo, jump, dynamics), a repeat, a volta, or
// a special barline. A measure that only *starts* with such a thing (an
// attribute change, a marking before the first rest, a start repeat or a volta
// start) may open a run; one that only *ends* with a special barline may close it.

export type RestRunsReport = { partId: string; runs: { first: number; count: number }[] };

const elements = (parent: Node): Element[] =>
  Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1);
const named = (parent: Element, name: string) => elements(parent).filter((element) => element.localName === name);

type Kind = { rest: boolean; canStart: boolean; canContinue: boolean; canEnd: boolean };

function classify(measure: Element): Kind {
  const children = elements(measure);
  const notes = children.filter((child) => child.localName === "note");
  // One whole-measure rest (MusicXML <rest measure="yes"/>, or a rest without a note type), as
  // MuseScore merges; a measure of shorter rests stays as it is.
  const restElement = notes.length === 1 ? named(notes[0], "rest")[0] : undefined;
  const rest =
    !!restElement &&
    (restElement.getAttribute("measure") === "yes" || named(notes[0], "type").length === 0) &&
    named(notes[0], "cue").length === 0 &&
    !children.some((child) => child.localName === "backup" || child.localName === "forward");
  if (!rest) {return { rest: false, canStart: false, canContinue: false, canEnd: false };}
  const firstNote = children.indexOf(notes[0]);
  // Things before the first rest only matter for the first measure of a run.
  const leading = children.slice(0, firstNote), trailing = children.slice(firstNote);
  const changes = (list: Element[]) =>
    list.some((child) => child.localName === "attributes" && elements(child).some((a) => a.localName !== "divisions"));
  const markings = (list: Element[]) => list.some((child) => ["direction", "harmony", "sound", "figured-bass"].includes(child.localName));
  const barline = (location: string) =>
    children.some((child) => child.localName === "barline" && (child.getAttribute("location") ?? "right") === location);
  const opens = changes(leading) || markings(leading) || barline("left");
  const closes = barline("right");
  const blocked = changes(trailing) || markings(trailing) || barline("middle");
  return {
    rest: true,
    canStart: !blocked,
    canContinue: !blocked && !opens && !closes,
    canEnd: !blocked && !opens,
  };
}

/** Marks runs of two or more rest-only measures as multi-measure rests, in place. */
export function condenseRestRuns(part: Element): RestRunsReport {
  const report: RestRunsReport = { partId: part.getAttribute("id") ?? "", runs: [] };
  // Parts with several staves keep every measure: a rest in one staff is not a rest in the other.
  if (Array.from(part.getElementsByTagName("staves")).some((staves) => Number(staves.textContent) > 1)) {return report;}
  const measures = named(part, "measure");
  const kinds = measures.map(classify);
  for (let i = 0; i < measures.length; ) {
    if (!kinds[i].rest || !kinds[i].canStart) { i++; continue; }
    let end = i;
    while (end + 1 < measures.length && kinds[end + 1].rest && (kinds[end + 1].canContinue || kinds[end + 1].canEnd)) {
      end++;
      if (!kinds[end].canContinue) {break;}
    }
    const count = end - i + 1;
    if (count >= 2) {
      const document = part.ownerDocument;
      const first = measures[i];
      let attributes = named(first, "attributes")[0];
      if (!attributes) {
        attributes = document.createElement("attributes");
        first.insertBefore(attributes, elements(first)[0] ?? null);
      }
      const style = document.createElement("measure-style");
      const multiple = document.createElement("multiple-rest");
      multiple.textContent = String(count);
      style.appendChild(multiple);
      attributes.appendChild(style);
      report.runs.push({ first: i, count });
    }
    i = end + 1;
  }
  return report;
}
