// LOW TUBA TABLE SIGN-OFF: PENDING. A brass player has not yet reviewed
// TUBA_LOW_VALVES (4-valve pistons), the valve-trombone rule or the tuba-46 exception (ticket
// 008). Record the reviewer and date here when they do.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  TUBA_LOW_VALVES,
  fingeringFunction,
  instrumentSettings,
  pirataInstrument,
  type FingeringNotation,
} from ".";

type GriffFn = (midi: number) => string;
const plugin = (name: string, imports: object = {}): Record<string, unknown> => {
  const source = readFileSync(new URL(`../../../plugin/${name}`, import.meta.url), "utf8")
    .replace(/^\.(pragma|import).*$/gm, "");
  const context: Record<string, unknown> = { ...imports };
  runInNewContext(source, context, { filename: name });
  return context;
};
const Fingerings = plugin("fingerings.js");
const MsInstruments = plugin("musescoreInstruments.js", { Fingerings });
const pluginFn = (id: string, oneChar: boolean, dynamic = false) =>
  (MsInstruments.getGriffFn as (...a: unknown[]) => GriffFn)(id, null, oneChar, false, dynamic);

const notation = (overrides: Partial<FingeringNotation>): FingeringNotation => ({
  notation: "positions",
  dynamicTrombone: false,
  ...overrides,
});
const fn = (id: string, overrides: Partial<FingeringNotation> = {}) =>
  fingeringFunction(instrumentSettings(id), notation(overrides))!;
const PITCHES = Array.from({ length: 128 }, (_, i) => i);
// Tuba notes below the 3-valve table (C-indexed 25–29) are always written as 4-valve pistons.
const tubaLow = (id: string, pitch: number) => {
  const settings = instrumentSettings(id)!;
  const index = pitch + settings.transpositionForTable;
  return settings.fingering!.family === "tuba" && index >= 25 && index < 30 ? TUBA_LOW_VALVES[index] : null;
};
const VALVE_IDS = ["bb-trumpet", "c-trumpet", "bb-tuba", "bass-eb-tuba", "bb-tuba-treble", "eb-tuba-treble", "sousaphone", "euphonium", "euphonium-treble"];

describe("valves", () => {
  it.each(VALVE_IDS)("matches the plugin's default output for %s", (id) => {
    const ours = fn(id, { notation: "valves" });
    const theirs = pluginFn(id, false);
    for (const pitch of PITCHES) {expect(ours(pitch), `${pitch}`).toBe(tubaLow(id, pitch) ?? theirs(pitch));}
  });

  it("fingers trombone as a valve trombone: the trumpet table an octave down", () => {
    const trumpet = Fingerings.griff_trumpet as (midi: number, breakLine: boolean) => string;
    for (const dynamicTrombone of [false, true]) {
      const ours = fn("trombone", { notation: "valves", dynamicTrombone });
      for (let index = 43; index <= 71; index++) {
        expect(ours(index - 2)).toBe(trumpet(index + 12, false));
        expect(ours(index - 2)).not.toBe("");
      }
      // The top of the slide range is past the trumpet table.
      expect(ours(75 - 2)).toBe("");
    }
  });
});

describe("positions", () => {
  it("is the default", () => {
    // Sounding Bb3 is the open written C4 on a Bb trumpet; D4 (written E4) is 1-2.
    expect(fingeringFunction(instrumentSettings("bb-trumpet"))!(58)).toBe("1");
    expect(fingeringFunction(instrumentSettings("bb-trumpet"))!(62)).toBe("4");
  });

  it.each(["bb-tuba", "bass-eb-tuba", "bb-tuba-treble", "eb-tuba-treble", "sousaphone", "euphonium", "euphonium-treble"])(
    "matches the plugin's one-char output for %s, but for the tuba-46 exception",
    (id) => {
      const ours = fn(id);
      const theirs = pluginFn(id, true);
      const shift = instrumentSettings(id)!.transpositionForTable;
      for (const pitch of PITCHES) {
        if (id !== "euphonium" && id !== "euphonium-treble" && pitch + shift === 46) {
          // griff_tuba_onechar(46) is 4, but griff_tuba(46) is valve 1: position 3.
          expect(theirs(pitch)).toBe("4");
          expect(ours(pitch)).toBe("3");
        } else {
          expect(ours(pitch), `${pitch}`).toBe(tubaLow(id, pitch) ?? theirs(pitch));
        }
      }
    },
  );

  it("gives trumpet positions from its valve table", () => {
    const ours = fn("bb-trumpet");
    const valves = fn("bb-trumpet", { notation: "valves" });
    const map: Record<string, string> = { "0": "1", "2": "2", "1": "3", "12": "4", "23": "5", "13": "6", "123": "7", "": "" };
    for (const pitch of PITCHES) {expect(ours(pitch)).toBe(map[valves(pitch)]);}
    expect(PITCHES.filter((pitch) => ours(pitch)).length).toBe(33);
  });

  it("matches griff_trombone, and the dynamic picker when asked", () => {
    for (const pitch of PITCHES) {expect(fn("trombone")(pitch)).toBe(pluginFn("trombone", false)(pitch));}
    const ours = fn("trombone", { dynamicTrombone: true });
    const theirs = pluginFn("trombone", false, true);
    for (const pitch of [41, 53, 52, 56, 68, 69, 70, 47, 64, 58]) {expect(ours(pitch)).toBe(theirs(pitch));}
  });
});

describe("low tuba notes", () => {
  // Every pitch of the Bb and Eb tubas, the low extension included, in both notations.
  it.each([["bb-tuba", 2], ["bass-eb-tuba", -3], ["sousaphone", 2], ["eb-tuba-treble", -3]] as const)("writes %s's notes below the 3-valve range as 4-valve pistons", (id, shift) => {
    const semitones: Record<string, number> = { "1": 2, "2": 1, "3": 3, "4": 5 };
    const lowering = (combination: string) => [...combination].reduce((sum, valve) => sum + semitones[valve], 0);
    for (const notation of ["positions", "valves"] as const) {
      const ours = fn(id, { notation });
      for (const pitch of PITCHES) {
        const index = pitch + shift;
        if (index < 25) {expect(ours(pitch), `${notation} ${pitch}`).toBe("");}
        else if (index < 30) {
          // Each step a semitone below the open C (index 36).
          expect(lowering(ours(pitch)), `${notation} ${pitch}`).toBe(36 - index);
          expect(ours(pitch)).toContain("4");
        }
      }
    }
    // In the 3-valve range nothing changes: 1-3 and 1-2-3 stay as they are.
    expect(fn(id, { notation: "valves" })(31 - shift)).toBe("13");
    expect(fn(id)(30 - shift)).toBe("7");
  });

  it("leaves other instruments' low notes without fingering", () => {
    expect(fn("euphonium", { notation: "valves" })(30)).toBe("");
    expect(fn("bb-trumpet")(40)).toBe("");
  });
});

describe("pirataInstrument", () => {
  it("files fingered trumpet and trombone parts as piratas, and back", () => {
    expect(pirataInstrument("trompete", true)).toBe("trompete pirata");
    expect(pirataInstrument("trombone", true)).toBe("trombone pirata");
    expect(pirataInstrument("trompete pirata", false)).toBe("trompete");
    expect(pirataInstrument("trombone pirata", true)).toBe("trombone pirata");
    expect(pirataInstrument("tuba", true)).toBe("tuba");
    expect(pirataInstrument("bombardino", true)).toBe("bombardino");
    expect(pirataInstrument("flauta", false)).toBe("flauta");
  });
});
