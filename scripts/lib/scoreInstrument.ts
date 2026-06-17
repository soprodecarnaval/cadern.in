import type { Instrument } from "../../types/instrument";

// MuseScore 4 instrumentId → cadern.in Instrument.
// Mapped by instrumentId (reliable) rather than part name (which can be
// localized, e.g. "Eufônio Bb" has no alias). Unknown ids are incompatible.
const ID_MAP: Record<string, Instrument> = {
  flute: "flauta",
  "bb-clarinet": "clarinete",
  "eb-clarinet": "clarinete",
  "bb-trumpet": "trompete",
  "c-trumpet": "trompete",
  "alto-saxophone": "sax alto",
  "soprano-saxophone": "sax soprano",
  "tenor-saxophone": "sax tenor",
  trombone: "trombone",
  euphonium: "bombardino",
};

const hasEb = (name: string): boolean => /\beb\b|e♭/i.test(name);

export const mapInstrumentId = (
  instrumentId: string,
  name = "",
): Instrument | undefined => {
  switch (instrumentId) {
    case "tuba":
    case "bb-tuba":
      return hasEb(name) ? "tuba eb" : "tuba";
    case "eb-tuba":
    case "bass-eb-tuba":
      return "tuba eb";
    default:
      return ID_MAP[instrumentId];
  }
};
