import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import type { Instrument } from "../../../types/instrument";
import { inspect } from "../browserScore/input";
import { excerptInstruments } from "../browserScore/partInstruments";
import {
  chosenFamily,
  chosenInstrumentSettings,
  guessInstrument,
  instrumentSettings,
  mapInstrumentId,
  newTrombonePicker,
  valveText,
  type InstrumentNames,
} from ".";

// The QML libraries this module replaces, loaded as the plugin tests load them.
type PluginPart = { partName?: string; longName?: string; shortName?: string };
type GriffFn = (midi: number, breakLine?: boolean) => string;
type PluginSettings = {
  griffFn: GriffFn;
  oneCharFn?: GriffFn;
  transposition: number;
  tubaPolicy?: object;
  dynamicTrombone?: boolean;
};
const plugin = (name: string, imports: object = {}): Record<string, unknown> => {
  const source = readFileSync(
    new URL(`../../../plugin/${name}`, import.meta.url),
    "utf8",
  ).replace(/^\.(pragma|import).*$/gm, "");
  const context: Record<string, unknown> = { ...imports };
  runInNewContext(source, context, { filename: name });
  return context;
};
const Fingerings = plugin("fingerings.js");
const MsInstruments = plugin("musescoreInstruments.js", { Fingerings });
const Caderninho = plugin("caderninInstruments.js", { MsInstruments });
const pluginSettings = MsInstruments.getInstrumentSettings as (
  id: string,
  part: PluginPart | null,
) => PluginSettings | null;
const pluginInstrument = Caderninho.getCaderninhoInstrument as (
  id: string,
  part: PluginPart | null,
) => Instrument | null;
const namesOf = (part: PluginPart | null): InstrumentNames =>
  part ? [part.partName, part.longName, part.shortName] : [];

// Every distinct instrumentId MuseScore writes for test-scores/all-instruments.mscz,
// with its part name: the name is what distinguishes an Eb tuba from a Bb one.
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

// Every id the plugin's tables name. The mapping table (getCaderninhoInstrument)
// names all but these; for them it falls through to a name guess.
const NOT_IN_PLUGIN_MAPPING = new Set([
  "eb-tuba", "bb-tuba-treble", "eb-tuba-treble", "sousaphone", "bb-sousaphone", "bb-sousaphone-treble",
]);
const PLUGIN_IDS = [
  "brass.trombone", "trombone", "brass.trombone.tenor", "bb-tuba", "brass.tuba",
  "tuba", "bass-eb-tuba", "eb-tuba", "bb-tuba-treble", "eb-tuba-treble",
  "sousaphone", "bb-sousaphone", "bb-sousaphone-treble", "trumpet", "bb-trumpet",
  "brass.trumpet.bflat", "brass.trumpet", "c-trumpet", "euphonium-treble",
  "brass.euphonium", "euphonium", "wind.flutes.flute", "flute",
  "wind.reed.clarinet.bflat", "wind.reed.clarinet", "clarinet.bflat", "clarinet",
  "wind.reed.saxophone.alto", "saxophone.alto", "alto-sax",
  "wind.reed.saxophone.soprano", "saxophone.soprano", "soprano-sax",
  "wind.reed.saxophone.tenor", "saxophone.tenor", "tenor-sax",
];
const PLUGIN_PARTS: (PluginPart | null)[] = [
  null,
  { longName: "E♭ Tuba" },
  { longName: "Bb Tuba" },
  { shortName: "E♭" },
  { partName: "Eb" },
];

describe("mapInstrumentId", () => {
  it.each(FIXTURE_PARTS)("maps %s (%s)", (instrumentId, name, expected) => {
    expect(mapInstrumentId(instrumentId, [name])).toBe(expected);
  });

  it("resolves treble-clef variants as their concert-pitch instrument", () => {
    expect(mapInstrumentId("euphonium-treble")).toBe(mapInstrumentId("euphonium"));
  });

  it("keeps the Eb tuba distinction on treble-clef variants", () => {
    expect(mapInstrumentId("bb-tuba-treble", ["Tuba E♭ (clave G)"])).toBe("tuba eb");
  });

  it("accepts the long MusicXML vocabulary too", () => {
    expect(mapInstrumentId("brass.euphonium")).toBe("bombardino");
    expect(mapInstrumentId("wind.reed.saxophone.baritone")).toBe("sax baritono");
    expect(mapInstrumentId("brass.sousaphone")).toBe("tuba");
    expect(mapInstrumentId("brass.tuba.bass")).toBe("tuba eb");
  });

  it("disambiguates brass.tuba by any of the part's names", () => {
    expect(mapInstrumentId("brass.tuba", ["Tuba B♭ (concerto)"])).toBe("tuba");
    expect(mapInstrumentId("brass.tuba", ["Bass Tuba", "Tuba E♭ (clave G)"])).toBe("tuba eb");
    expect(mapInstrumentId("brass.tuba", ["Tuba", "", "Tba. Eb"])).toBe("tuba eb");
  });

  it("maps tenor-trombone, common in older scores, as trombone with slide positions", () => {
    expect(mapInstrumentId("tenor-trombone", ["BONE"])).toBe("trombone");
    expect(instrumentSettings("tenor-trombone")).toEqual(instrumentSettings("trombone"));
  });

  it("returns null for instruments cadern.in does not support", () => {
    expect(mapInstrumentId("pipe-organ", ["Órgão"])).toBeNull();
    expect(mapInstrumentId("toString")).toBeNull();
  });

  // Where the plugin's id table differs, the exporter's (now this one) wins:
  // the plugin's bb-tuba ignores an Eb name.
  it("agrees with the plugin's id table", () => {
    for (const id of PLUGIN_IDS.filter((id) => !NOT_IN_PLUGIN_MAPPING.has(id))) {
      for (const part of PLUGIN_PARTS) {
        const ours = mapInstrumentId(id, namesOf(part));
        const theirs = pluginInstrument(id, part);
        if (id === "bb-tuba" && ours === "tuba eb") {
          expect(theirs).toBe("tuba");
        } else {
          expect(ours, `${id} ${JSON.stringify(part)}`).toBe(theirs);
        }
      }
    }
  });
});

describe("guessInstrument", () => {
  it("guesses from names like the plugin's fallback", () => {
    const names: PluginPart[] = [
      { longName: "Bone 2" },
      { partName: "Tuba Eb" },
      { shortName: "alto-sax" },
      { longName: "Pete" },
      { longName: "Órgão" },
    ];
    for (const part of names) {
      expect(guessInstrument(namesOf(part))).toBe(pluginInstrument("unknown", part));
    }
    expect(guessInstrument(["Bone 2"])).toBe("trombone");
    expect(guessInstrument(["Órgão"])).toBeNull();
  });
});

describe("instrumentSettings", () => {
  // The TS settings must give, for every pitch, what the plugin's settings give.
  it.each(PLUGIN_IDS)("matches the plugin's settings for %s", (id) => {
    for (const part of PLUGIN_PARTS) {
      const ours = instrumentSettings(id, namesOf(part));
      const theirs = pluginSettings(id, part);
      if (!theirs) {
        expect(ours).toBeNull();
        continue;
      }
      expect(ours).not.toBeNull();
      expect(ours!.transpositionForTable).toBe(theirs.transposition);
      expect(ours!.tubaPolicy ?? null).toEqual(theirs.tubaPolicy ?? null);
      expect(!!ours!.dynamicTrombone).toBe(!!theirs.dynamicTrombone);
      const fingering = ours!.fingering!;
      for (let index = 0; index <= 127; index++) {
        if (fingering.slide) {
          // The plugin fingers trombone by slide position only.
          expect(String(fingering.slide.positions[index] ?? "")).toBe(theirs.griffFn(index));
        } else {
          for (const breakLine of [false, true]) {
            expect(valveText(fingering.valves, index + fingering.valveIndexOffset, breakLine)).toBe(
              theirs.griffFn(index, breakLine),
            );
          }
        }
      }
    }
  });

  it("gives trombone the trumpet table an octave down for valves", () => {
    const trombone = instrumentSettings("trombone")!.fingering!;
    const trumpet = Fingerings.griff_trumpet as GriffFn;
    for (let index = 43; index <= 71; index++) {
      expect(valveText(trombone.valves, index + trombone.valveIndexOffset)).toBe(trumpet(index + 12));
      expect(valveText(trombone.valves, index + trombone.valveIndexOffset)).not.toBe("");
    }
  });

  it("keeps the dynamic trombone picker's choices", () => {
    const first = newTrombonePicker();
    const second = newTrombonePicker();
    const theirs = (Fingerings.newTrombonePicker as () => { pick: (m: number) => string })();
    expect(first(41 + 2)).toBe("6");
    expect(first(53 + 2)).toBe("6");
    expect(second(53 + 2)).toBe("1");
    const ours = newTrombonePicker();
    for (const index of [43, 55, 49, 54, 70, 71, 72, 76, 60, 58, 49, 54, 66, 73, 30]) {
      expect(ours(index)).toBe(theirs.pick(index));
    }
  });

  it("returns null for instruments without fingerings", () => {
    expect(instrumentSettings("flute")).toBeNull();
    expect(instrumentSettings("c-tuba")).toBeNull();
    expect(instrumentSettings("toString")).toBeNull();
  });
});

describe("test-scores/all-instruments.mscz", () => {
  const bytes = new Uint8Array(
    readFileSync(new URL("../../../test-scores/all-instruments.mscz", import.meta.url)),
  );
  const info = inspect(bytes, "mscz");

  it("maps every score part to an instrument", () => {
    expect(info.scoreParts.length).toBe(19);
    for (const part of info.scoreParts) {
      expect(part.instruments.length).toBe(1);
      const [instrument] = part.instruments;
      const names = [part.trackName, instrument.longName, instrument.shortName];
      expect(mapInstrumentId(instrument.id, names), instrument.id).not.toBeNull();
      expect(mapInstrumentId(instrument.soundId!, names), instrument.soundId!).toBe(
        mapInstrumentId(instrument.id, names),
      );
    }
  });

  it("finds the instruments of every saved part", () => {
    const titles = Object.keys(info.savedPartIds);
    expect(titles.length).toBe(19);
    for (const [index, title] of titles.entries()) {
      const instruments = excerptInstruments({ title, parts: [] }, index, titles.length, info);
      expect(instruments.length, title).toBe(1);
    }
    expect(
      excerptInstruments({ title: "12_Tuba_Eb", parts: [] }, 0, 19, info).map((i) => i.id),
    ).toEqual(["bass-eb-tuba"]);
  });
});

describe("chosenInstrumentSettings", () => {
  it("formats a part as the instrument it is filed under", () => {
    expect(chosenInstrumentSettings("trompete pirata", instrumentSettings("flute"))?.fingering?.family).toBe("trumpet");
    expect(chosenInstrumentSettings("trombone", null)).toMatchObject({ transpositionForTable: 2, dynamicTrombone: true });
    expect(chosenInstrumentSettings("bombardino", null)?.fingering?.family).toBe("euphonium");
    expect(chosenInstrumentSettings("flauta", instrumentSettings("bb-trumpet"))).toBeNull();
    expect(chosenInstrumentSettings("sax alto", instrumentSettings("bb-tuba"))).toBeNull();
  });

  it("keeps the file's settings when they already are that instrument", () => {
    const cTrumpet = instrumentSettings("c-trumpet");
    expect(chosenInstrumentSettings("trompete", cTrumpet)).toBe(cTrumpet);
    const trebleTuba = instrumentSettings("bb-tuba-treble");
    expect(chosenInstrumentSettings("tuba", trebleTuba)).toBe(trebleTuba);
  });

  it("uses the chosen tuning for tuba fingerings, keeping how the file writes the tuba", () => {
    const asEb = chosenInstrumentSettings("tuba eb", instrumentSettings("bb-tuba-treble"));
    expect(asEb?.transpositionForTable).toBe(-3);
    expect(asEb?.tubaPolicy).toEqual(instrumentSettings("bb-tuba-treble")?.tubaPolicy);
    // A part the file does not declare as a tuba gets tuba fingerings, but no tuba notation.
    const fromHorn = chosenInstrumentSettings("tuba", instrumentSettings("horn"));
    expect(fromHorn).toMatchObject({ transpositionForTable: 2 });
    expect(fromHorn?.tubaPolicy).toBeUndefined();
  });

  it("names the fingering family of each instrument", () => {
    expect((["trompete", "trombone pirata", "tuba eb", "bombardino", "clarinete"] as const).map(chosenFamily))
      .toEqual(["trumpet", "trombone", "tuba", "euphonium", null]);
  });
});
