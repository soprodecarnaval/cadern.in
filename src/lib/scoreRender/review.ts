// Sign-off measures (ticket 016): how a browser-formatted part compares with
// the plugin-formatted one it replaces. DOM Level 2 only, like cleanup.ts.

const elements = (parent: Node): Element[] =>
  Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1);

/** Fingering text per note (measure:note index) of a part's MusicXML. */
function fingeringsByNote(document: Document): Map<string, string> {
  const out = new Map<string, string>();
  Array.from(document.getElementsByTagName("measure")).forEach((measure, m) => {
    elements(measure)
      .filter((element) => element.localName === "note")
      .forEach((note, n) => {
        const text = Array.from(note.getElementsByTagName("fingering"), (f) => (f.textContent ?? "").trim()).filter(Boolean).join("|");
        if (text) {out.set(`${m}:${n}`, text);}
      });
  });
  return out;
}

export type FingeringMatch = {
  /** Notes the plugin fingered. */
  plugin: number;
  /** Of those, notes with the same text in the browser output. */
  same: number;
  /** Notes fingered only by the browser. */
  extra: number;
  /** Differences, "plugin→browser", with counts. */
  differences: Record<string, number>;
};

/**
 * Compares the fingerings the plugin left in the file (the part's MusicXML
 * before clean-up) with the browser's (after the caderninho transform). The
 * note order is the same, as the transforms never add or remove notes.
 */
export function compareFingerings(before: Document, after: Document): FingeringMatch {
  const plugin = fingeringsByNote(before);
  const ours = fingeringsByNote(after);
  const match: FingeringMatch = { plugin: plugin.size, same: 0, extra: 0, differences: {} };
  for (const [key, text] of plugin) {
    const mine = ours.get(key) ?? "";
    if (mine === text) {match.same++;}
    else {match.differences[`${text}→${mine || "∅"}`] = (match.differences[`${text}→${mine || "∅"}`] ?? 0) + 1;}
  }
  for (const key of ours.keys()) {if (!plugin.has(key)) {match.extra++;}}
  return match;
}

/** Clefs of a part's MusicXML, as sign+line (and octave change), in order. */
export const clefsOf = (document: Document): string[] =>
  Array.from(document.getElementsByTagName("clef"), (clef) => {
    const text = (name: string) => clef.getElementsByTagName(name)[0]?.textContent?.trim() ?? "";
    return `${text("sign")}${text("line")}${text("clef-octave-change") ? `/${text("clef-octave-change")}` : ""}`;
  });

/**
 * Staff space (mm) and system count of a stored MuseScore page SVG, scaled to
 * a box of `boxWidthMm` (createSongBook draws the page into that width).
 */
export function storedPageLayout(svg: string, boxWidthMm: number): { staffSpaceMm: number; systems: number } | null {
  const width = Number(/viewBox="[\d.\s-]*?\s([\d.]+)\s[\d.]+"/.exec(svg)?.[1]);
  const lines = Array.from(svg.matchAll(/class="StaffLines"[^>]*points="[\d.]+,([\d.]+)\s/g), (m) => Number(m[1])).sort((a, b) => a - b);
  if (!(width > 0) || lines.length < 5) {return null;}
  const gaps: number[] = [];
  for (let i = 0; i + 4 < lines.length; i += 5) {gaps.push((lines[i + 4] - lines[i]) / 4);}
  const gap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  return { staffSpaceMm: Math.round(gap / width * boxWidthMm * 1000) / 1000, systems: Math.floor(lines.length / 5) };
}
