import type { Instrument } from "../types/instrument";
const instrumentAliases: [string, Instrument][] = [
  // bombardino
  ["bombardino", "bombardino"],
  // clarinete
  ["clarinet", "clarinete"],
  ["clarinete", "clarinete"],
  ["clarineta", "clarinete"],
  // flauta
  ["flauta", "flauta"],
  ["flute", "flauta"],
  ["flauta transversal", "flauta"],
  // sax alto
  ["alto", "sax alto"],
  ["sax alto", "sax alto"],
  ["sax alta", "sax alto"],
  ["saxophone alto", "sax alto"],
  ["alto sax", "sax alto"],
  // sax baritono
  ["sax baritono", "sax baritono"],
  ["sax barítono", "sax baritono"],
  ["baritone sax", "sax baritono"],
  ["bari sax", "sax baritono"],
  ["saxophone baritone", "sax baritono"],
  ["baritono", "sax baritono"],
  ["barítono", "sax baritono"],
  ["baritone", "sax baritono"],
  // sax soprano
  ["soprano", "sax soprano"],
  ["sax soprano", "sax soprano"],
  ["soprano sax", "sax soprano"],
  ["saxophone soprano", "sax soprano"],
  // sax tenor
  ["tenor", "sax tenor"],
  ["sax tenor", "sax tenor"],
  ["sax ternor", "sax tenor"],
  ["tenor sax", "sax tenor"],
  ["saxophone tenor", "sax tenor"],
  // trombone
  // ["trombone com pirata", "trombone pirata"],
  // ["trombone sem pirata", "trombone"],
  // ["trombone pirata", "trombone pirata"],
  ["trombone", "trombone"],
  // ["bone com pirata", "trombone pirata"],
  // ["bone sem pirata", "trombone"],
  // ["bone pirata", "trombone pirata"],
  ["bone", "trombone"],
  // trompete
  // ["trompete sem pirata", "trompete"],
  // ["trompete com pirata", "trompete pirata"],
  // ["trompete pirata", "trompete pirata"],
  ["trompete", "trompete"],
  ["trumpet", "trompete"],
  ["trompette", "trompete"],
  // ["pete com pirata", "trompete pirata"],
  // ["pete sem pirata", "trompete"],
  // ["pete pirata", "trompete pirata"],
  ["pete", "trompete"],
  // tuba
  ["tuba", "tuba"],
  ["sousaphone", "tuba"],
  ["tuba eb", "tuba eb"],
];

// We will sort them by number of parts descending, so we're sure that
// names with more parts will be matched before their subsets (e.g: 'trompete pirata' < 'trompete')
instrumentAliases.sort(
  (a, b) => b[0].split(" ").length - a[0].split(" ").length
);

export const parseInstrument = (raw: string): Instrument | undefined => {
  const normalized = raw.replace(/[_\-.]/g, " ").toLowerCase();
  const match = instrumentAliases.find(([alias]) => normalized.includes(alias));
  return match ? match[1] : undefined;
};

/**
 * Removes the instrument from an authored part name, for the songbook option
 * that prints "1" rather than "Trompete 1".
 *
 * Deliberately does not strip the song title, unlike extractPartLabel: part
 * names are authored now, so a part legitimately called "Marcha solo" in a song
 * called "Marcha" must not come out as "solo".
 */
export const stripInstrumentFromPartName = (
  partName: string,
): string | undefined => {
  const normalized = partName.replace(/[_\-.]/g, " ").toLowerCase();
  const match = instrumentAliases.find(([alias]) => normalized.includes(alias));
  const stripped = match ? normalized.replace(match[0], "") : normalized;
  return stripped.replace(/\s+/g, " ").trim() || undefined;
};

/** @deprecated pre-v2 part names only; see stripInstrumentFromPartName. */
export const extractPartLabel = (
  partName: string,
  songTitle: string,
  stripInstrument = false,
): string | undefined => {
  // Normalize: replace separators with spaces, lowercase
  let normalized = partName.replace(/[_\-.]/g, " ").toLowerCase();
  const normalizedSongTitle = songTitle.replace(/[_\-.]/g, " ").toLowerCase();

  // Remove song title
  normalized = normalized.replace(normalizedSongTitle, "");

  // Optionally remove instrument name
  if (stripInstrument) {
    const match = instrumentAliases.find(([alias]) =>
      normalized.includes(alias),
    );
    if (match) {
      normalized = normalized.replace(match[0], "");
    }
  }

  // Clean up: trim, collapse spaces
  const label = normalized.replace(/\s+/g, " ").trim();
  return label || undefined;
};
