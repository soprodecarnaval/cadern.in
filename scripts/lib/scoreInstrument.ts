import type { Instrument } from "../../types/instrument";

// MuseScore 4 instrumentId → cadern.in Instrument.
// Mapped by instrumentId (reliable) rather than part name (which can be
// localized, e.g. "Eufônio Bb" has no alias). Unknown ids are incompatible.
//
// MuseScore exposes two vocabularies for the same part: the short id on
// `<Instrument id="...">`, which `--score-meta` reports, and the long MusicXML
// sound id in `<instrumentId>`, which appears when reading the .mscx directly.
// Both are accepted. The long form is lossier — `brass.tuba` covers bb-tuba,
// bb-tuba-treble and eb-tuba-treble alike — so ids that it cannot disambiguate
// are resolved in the switch below rather than here.
const ID_MAP: Record<string, Instrument> = {
  flute: "flauta",
  "bb-clarinet": "clarinete",
  "eb-clarinet": "clarinete",
  "bb-trumpet": "trompete",
  "trumpet": "trompete",
  "c-trumpet": "trompete",
  "alto-saxophone": "sax alto",
  "soprano-saxophone": "sax soprano",
  "tenor-saxophone": "sax tenor",
  "baritone-saxophone": "sax baritono",
  trombone: "trombone",
  euphonium: "bombardino",
  sousaphone: "tuba",
  "bb-sousaphone": "tuba",

  // Long MusicXML sound ids.
  "wind.flutes.flute": "flauta",
  "wind.reed.clarinet.bflat": "clarinete",
  "wind.reed.saxophone.soprano": "sax soprano",
  "wind.reed.saxophone.alto": "sax alto",
  "wind.reed.saxophone.tenor": "sax tenor",
  "wind.reed.saxophone.baritone": "sax baritono",
  "brass.trumpet.bflat": "trompete",
  "brass.trombone": "trombone",
  "brass.euphonium": "bombardino",
  "brass.sousaphone": "tuba",
};

// MuseScore suffixes the treble-clef variant of an instrument (euphonium-treble,
// bb-tuba-treble, bb-sousaphone-treble). Clef does not change which cadern.in
// instrument a part belongs to, so resolve them as the concert-pitch id.
const stripTrebleSuffix = (instrumentId: string): string =>
  instrumentId.replace(/-treble$/, "");

const hasEb = (name: string): boolean => /\beb\b|e♭/i.test(name);

export const mapInstrumentId = (
  instrumentId: string,
  name = "",
): Instrument | undefined => {
  switch (stripTrebleSuffix(instrumentId)) {
    // `brass.tuba` cannot distinguish Eb from Bb, so it needs the name too.
    case "tuba":
    case "bb-tuba":
    case "brass.tuba":
      return hasEb(name) ? "tuba eb" : "tuba";
    case "eb-tuba":
    case "bass-eb-tuba":
    case "brass.tuba.bass":
      return "tuba eb";
    default:
      return ID_MAP[stripTrebleSuffix(instrumentId)];
  }
};
