import { describe, expect, it } from "vitest";
import { mapInstrumentId } from "./scoreInstrument";
import type { Instrument } from "../../types/instrument";

// Every distinct instrumentId that MuseScore reports for
// test-scores/all-instruments.mscz, with the part name it comes with. The name
// matters: it is what distinguishes an Eb tuba from a Bb one.
const FIXTURE_PARTS: Array<[string, string, Instrument]> = [
  ["flute", "Flauta", "flauta"],
  ["bb-clarinet", "Clarinete B♭", "clarinete"],
  ["soprano-saxophone", "Sax Soprano", "sax soprano"],
  ["alto-saxophone", "Sax Alto", "sax alto"],
  ["tenor-saxophone", "Sax Tenor", "sax tenor"],
  ["baritone-saxophone", "Sax Barítono", "sax baritono"],
  ["bb-trumpet", "Trompete B♭ 1", "trompete"],
  ["trombone", "Trombone 1", "trombone"],
  ["euphonium", "Eufônio B♭ (concerto)", "bombardino"],
  ["euphonium-treble", "Eufônio (clave G)", "bombardino"],
  ["bass-eb-tuba", "Tuba E♭ (concerto)", "tuba eb"],
  ["eb-tuba-treble", "Tuba E♭ (clave G)", "tuba eb"],
  ["bb-tuba", "Tuba B♭ (concerto)", "tuba"],
  ["bb-tuba-treble", "Tuba B♭ (clave G)", "tuba"],
  ["sousaphone", "Sousafone B♭ (concerto)", "tuba"],
  ["bb-sousaphone", "Sousafone B♭ (transposto)", "tuba"],
  ["bb-sousaphone-treble", "Sousafone B♭ (clave G)", "tuba"],
];

describe("mapInstrumentId", () => {
  it.each(FIXTURE_PARTS)("maps %s (%s)", (instrumentId, name, expected) => {
    expect(mapInstrumentId(instrumentId, name)).toBe(expected);
  });

  it("resolves treble-clef variants as their concert-pitch instrument", () => {
    expect(mapInstrumentId("euphonium-treble")).toBe(
      mapInstrumentId("euphonium"),
    );
  });

  it("keeps the Eb tuba distinction on treble-clef variants", () => {
    expect(mapInstrumentId("bb-tuba-treble", "Tuba E♭ (clave G)")).toBe(
      "tuba eb",
    );
  });

  it("accepts the long MusicXML vocabulary too", () => {
    expect(mapInstrumentId("brass.euphonium")).toBe("bombardino");
    expect(mapInstrumentId("wind.reed.saxophone.baritone")).toBe(
      "sax baritono",
    );
    expect(mapInstrumentId("brass.sousaphone")).toBe("tuba");
    expect(mapInstrumentId("brass.tuba.bass")).toBe("tuba eb");
  });

  // brass.tuba is the one long id that collapses distinct instruments, so it
  // still depends on the part name.
  it("disambiguates brass.tuba by part name", () => {
    expect(mapInstrumentId("brass.tuba", "Tuba B♭ (concerto)")).toBe("tuba");
    expect(mapInstrumentId("brass.tuba", "Tuba E♭ (clave G)")).toBe("tuba eb");
  });

  it("returns undefined for instruments cadern.in does not support", () => {
    expect(mapInstrumentId("pipe-organ", "Órgão")).toBeUndefined();
  });
});
