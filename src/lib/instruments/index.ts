// One instrument table for the browser, the exporter and the tests:
// MuseScore instrument id → cadern.in Instrument, and the formatting settings
// each instrument gets (fingering tables, table transposition, tuba policy,
// dynamic trombone). Replaces scripts/lib/scoreInstrument.ts and
// plugin/{caderninInstruments,musescoreInstruments}.js.
//
// MuseScore writes two vocabularies for the same instrument: the short id on
// `<Instrument id="...">` (bb-tuba-treble) and the long MusicXML sound id in
// `<instrumentId>` (brass.tuba). Both are accepted. The long form is lossier —
// `brass.tuba` covers bb-tuba, bb-tuba-treble and eb-tuba-treble alike — so the
// ids it cannot disambiguate also look at the part's names.
import type { Instrument } from "../../../types/instrument";
import {
  EUPHONIUM_VALVES,
  TROMBONE_ALTERNATIVES,
  TROMBONE_POSITIONS,
  TRUMPET_VALVES,
  TUBA_VALVES,
  type SlideAlternatives,
  type SlideTable,
  type ValveTable,
} from "./fingerings";

export * from "./fingerings";

/** Part names to look at: part (track) name, instrument long and short names. */
export type InstrumentNames = readonly (string | null | undefined)[];

const ID_MAP: Readonly<Record<string, Instrument>> = {
  flute: "flauta",
  "wind.flutes.flute": "flauta",

  "bb-clarinet": "clarinete",
  "eb-clarinet": "clarinete",
  clarinet: "clarinete",
  "clarinet.bflat": "clarinete",
  "wind.reed.clarinet": "clarinete",
  "wind.reed.clarinet.bflat": "clarinete",

  "soprano-saxophone": "sax soprano",
  "soprano-sax": "sax soprano",
  "saxophone.soprano": "sax soprano",
  "wind.reed.saxophone.soprano": "sax soprano",
  "alto-saxophone": "sax alto",
  "alto-sax": "sax alto",
  "saxophone.alto": "sax alto",
  "wind.reed.saxophone.alto": "sax alto",
  "tenor-saxophone": "sax tenor",
  "tenor-sax": "sax tenor",
  "saxophone.tenor": "sax tenor",
  "wind.reed.saxophone.tenor": "sax tenor",
  "baritone-saxophone": "sax baritono",
  "wind.reed.saxophone.baritone": "sax baritono",

  trumpet: "trompete",
  "bb-trumpet": "trompete",
  "c-trumpet": "trompete",
  "brass.trumpet": "trompete",
  "brass.trumpet.bflat": "trompete",

  trombone: "trombone",
  // MuseScore's tenor trombone id, common in older scores.
  "tenor-trombone": "trombone",
  "brass.trombone": "trombone",
  "brass.trombone.tenor": "trombone",

  euphonium: "bombardino",
  "brass.euphonium": "bombardino",

  sousaphone: "tuba",
  "bb-sousaphone": "tuba",
  "brass.sousaphone": "tuba",
};

// MuseScore suffixes the treble-clef variant of an instrument (euphonium-treble,
// bb-tuba-treble, bb-sousaphone-treble). Clef does not change which cadern.in
// instrument a part belongs to, so they map as the concert-pitch id.
const stripTrebleSuffix = (instrumentId: string): string =>
  instrumentId.replace(/-treble$/, "");

/** Whether any of the names says E♭ ("Tuba Eb", "E♭ Tuba"). */
export const hasEb = (names: InstrumentNames): boolean =>
  names.some((name) => !!name && /\beb\b|e♭/i.test(name));

/**
 * The cadern.in instrument of a MuseScore instrument id, or null when cadern.in
 * has none. Mapping is by id, never by name alone (names are localized: "Eufônio
 * B♭" has no alias); names only tell Eb from Bb tubas. For unmapped parts the
 * caller reports the part and lets the user pick (see `guessInstrument`).
 */
export const mapInstrumentId = (
  instrumentId: string,
  names: InstrumentNames = [],
): Instrument | null => {
  switch (stripTrebleSuffix(instrumentId)) {
    case "tuba":
    case "bb-tuba":
    case "brass.tuba":
      return hasEb(names) ? "tuba eb" : "tuba";
    case "eb-tuba":
    case "bass-eb-tuba":
    case "brass.tuba.bass":
      return "tuba eb";
    default:
      return Object.prototype.hasOwnProperty.call(
        ID_MAP,
        stripTrebleSuffix(instrumentId),
      )
        ? ID_MAP[stripTrebleSuffix(instrumentId)]
        : null;
  }
};

// Ordered longest-match first so "tuba" does not match before "tuba eb".
const NAME_ALIASES: readonly (readonly [string, Instrument])[] = [
  ["sax soprano", "sax soprano"],
  ["soprano sax", "sax soprano"],
  ["saxophone soprano", "sax soprano"],
  ["sax ternor", "sax tenor"],
  ["sax tenor", "sax tenor"],
  ["tenor sax", "sax tenor"],
  ["saxophone tenor", "sax tenor"],
  ["sax alta", "sax alto"],
  ["sax alto", "sax alto"],
  ["alto sax", "sax alto"],
  ["saxophone alto", "sax alto"],
  ["tuba eb", "tuba eb"],
  ["flauta transversal", "flauta"],
  ["bombardino", "bombardino"],
  ["euphonium", "bombardino"],
  ["trombone", "trombone"],
  ["bone", "trombone"],
  ["trompette", "trompete"],
  ["trompete", "trompete"],
  ["trumpet", "trompete"],
  ["pete", "trompete"],
  ["clarineta", "clarinete"],
  ["clarinete", "clarinete"],
  ["clarinet", "clarinete"],
  ["flauta", "flauta"],
  ["flute", "flauta"],
  ["sousaphone", "tuba"],
  ["tuba", "tuba"],
];

/**
 * A guess from the part's names, for parts whose id has no mapping (the
 * plugin's name fallback). Only a suggestion for the user to confirm.
 */
export const guessInstrument = (names: InstrumentNames): Instrument | null => {
  const haystack = names
    .map((name) => name ?? "")
    .join(" ")
    .toLowerCase()
    .replace(/[_\-.]/g, " ");
  return NAME_ALIASES.find(([alias]) => haystack.includes(alias))?.[1] ?? null;
};

export type TubaPolicy = {
  tuning: "Bb" | "Eb";
  /**
   * How the part is notated in MuseScore: concert pitch an octave down (F8vb
   * clef), transposed in treble clef, or transposed in bass clef (left alone).
   */
  mode: "concert-octave" | "transposed-treble" | "transposed-bass";
  /** The instrument's own written→sounding transposition, in semitones. */
  nativeTranspose: number;
  /** Whether a customized transposition can be reset to the instrument's own. */
  canResetInstrument: boolean;
};

export type FingeringTables = {
  family: "trumpet" | "trombone" | "tuba" | "euphonium";
  /** 3-valve table. Trombone uses the trumpet's (valve trombone, see valveIndexOffset). */
  valves: ValveTable;
  /** Added to the table index before the valve lookup: 12 for trombone (an octave down). */
  valveIndexOffset: number;
  /** Slide positions, trombone only. */
  slide?: { positions: SlideTable; alternatives: SlideAlternatives };
};

export type InstrumentSettings = {
  fingering?: FingeringTables;
  /** Added to the sounding MIDI pitch to index the fingering tables (C-indexed). */
  transpositionForTable: number;
  tubaPolicy?: TubaPolicy;
  /** The instrument supports the dynamic trombone picker (slide positions). */
  dynamicTrombone?: boolean;
};

const TRUMPET: FingeringTables = { family: "trumpet", valves: TRUMPET_VALVES, valveIndexOffset: 0 };
const TROMBONE: FingeringTables = {
  family: "trombone",
  valves: TRUMPET_VALVES,
  valveIndexOffset: 12,
  slide: { positions: TROMBONE_POSITIONS, alternatives: TROMBONE_ALTERNATIVES },
};
const TUBA: FingeringTables = { family: "tuba", valves: TUBA_VALVES, valveIndexOffset: 0 };
const EUPHONIUM: FingeringTables = { family: "euphonium", valves: EUPHONIUM_VALVES, valveIndexOffset: 0 };

const tuba = (
  tuning: TubaPolicy["tuning"],
  mode: TubaPolicy["mode"],
  nativeTranspose: number,
  canResetInstrument = true,
): InstrumentSettings => ({
  fingering: TUBA,
  // The table is indexed as a C tuba: sounding Bb/Eb open notes map to C.
  transpositionForTable: tuning === "Eb" ? -3 : 2,
  tubaPolicy: { tuning, mode, nativeTranspose, canResetInstrument },
});

/**
 * Formatting settings of a MuseScore instrument id, or null when the
 * instrument gets no fingerings or tuba notation (woodwinds, unknown ids).
 * Matches the plugin's getInstrumentSettings.
 */
export const instrumentSettings = (
  instrumentId: string,
  names: InstrumentNames = [],
): InstrumentSettings | null => {
  switch (instrumentId) {
    case "bb-tuba":
    case "sousaphone":
      return tuba("Bb", "concert-octave", 0);
    case "bass-eb-tuba":
    case "eb-tuba":
      return tuba("Eb", "concert-octave", 0);
    case "bb-tuba-treble":
    case "bb-sousaphone-treble":
      return tuba("Bb", "transposed-treble", -26);
    case "eb-tuba-treble":
      return tuba("Eb", "transposed-treble", -21);
    case "bb-sousaphone":
      return tuba("Bb", "transposed-bass", -14);
    case "tuba":
      return tuba(hasEb(names) ? "Eb" : "Bb", "concert-octave", 0);
    case "brass.tuba":
      return tuba(hasEb(names) ? "Eb" : "Bb", "concert-octave", 0, false);
    case "brass.trombone":
    case "trombone":
    case "tenor-trombone":
    case "brass.trombone.tenor":
      return { fingering: TROMBONE, transpositionForTable: 2, dynamicTrombone: true };
    case "trumpet":
    case "bb-trumpet":
    case "brass.trumpet.bflat":
    case "brass.trumpet":
      return { fingering: TRUMPET, transpositionForTable: 2 };
    case "c-trumpet":
      return { fingering: TRUMPET, transpositionForTable: 0 };
    case "euphonium-treble":
    case "brass.euphonium":
    case "euphonium":
      return { fingering: EUPHONIUM, transpositionForTable: 2 };
    default:
      return null;
  }
};
/** The fingering family a cadern.in instrument plays in, or null (no fingerings). */
export function chosenFamily(instrument: Instrument): FingeringTables["family"] | null {
  switch (instrument.replace(/ pirata$/, "")) {
    case "trompete": return "trumpet";
    case "trombone": return "trombone";
    case "tuba":
    case "tuba eb": return "tuba";
    case "bombardino": return "euphonium";
    default: return null;
  }
}

/**
 * The formatting settings of a part filed as `chosen`, whatever the file declares (`source`, the
 * MuseScore instrument's settings): its fingering table, tuba tuning, trombone options. The source's
 * settings are kept when they already are that instrument (a C trumpet, a tuba written in treble clef).
 * Tuba notation (clefs, octave) describes how the file is written, so it only applies to a part the
 * file already declares as a tuba; the written notes are never transposed.
 */
export function chosenInstrumentSettings(chosen: Instrument, source: InstrumentSettings | null): InstrumentSettings | null {
  const family = chosenFamily(chosen);
  if (!family) {return null;}
  if (family !== "tuba") {
    if (source?.fingering?.family === family) {return source;}
    if (family === "trumpet") {return { fingering: TRUMPET, transpositionForTable: 2 };}
    if (family === "trombone") {return { fingering: TROMBONE, transpositionForTable: 2, dynamicTrombone: true };}
    return { fingering: EUPHONIUM, transpositionForTable: 2 };
  }
  const tuning = chosen === "tuba eb" ? "Eb" : "Bb";
  const transpositionForTable = tuning === "Eb" ? -3 : 2;
  if (source?.tubaPolicy) {
    return source.tubaPolicy.tuning === tuning ? source : { ...source, fingering: TUBA, transpositionForTable };
  }
  return { fingering: TUBA, transpositionForTable };
}
export * from "./notation";
