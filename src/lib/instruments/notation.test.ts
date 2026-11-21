// 4-VALVE TUBA TABLE SIGN-OFF: PENDING. A brass player has not yet reviewed
// TUBA_4V_VALVES, the valve-trombone rule or the tuba-46 exception (ticket
// 008). Record the reviewer and date here when they do.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  TUBA_4V_VALVES,
  fingeringFunction,
  hasValveCountOption,
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
  valveCount: 3,
  dynamicTrombone: false,
  ...overrides,
});
const fn = (id: string, overrides: Partial<FingeringNotation> = {}) =>
  fingeringFunction(instrumentSettings(id), notation(overrides))!;
const PITCHES = Array.from({ length: 128 }, (_, i) => i);
const VALVE_IDS = ["bb-trumpet", "c-trumpet", "bb-tuba", "bass-eb-tuba", "bb-tuba-treble", "eb-tuba-treble", "sousaphone", "euphonium", "euphonium-treble"];

describe("valves", () => {
  it.each(VALVE_IDS)("matches the plugin's default output for %s", (id) => {
    const ours = fn(id, { notation: "valves" });
    const theirs = pluginFn(id, false);
    for (const pitch of PITCHES) {expect(ours(pitch), `${pitch}`).toBe(theirs(pitch));}
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
          expect(ours(pitch), `${pitch}`).toBe(theirs(pitch));
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

describe("4-valve tuba", () => {
  it("is offered for tuba only", () => {
    for (const id of ["bb-tuba", "eb-tuba-treble", "sousaphone", "brass.tuba"]) {
      expect(hasValveCountOption(instrumentSettings(id))).toBe(true);
    }
    for (const id of ["trombone", "bb-trumpet", "euphonium", "flute"]) {
      expect(hasValveCountOption(instrumentSettings(id))).toBe(false);
    }
    // Other instruments ignore valveCount.
    const euphonium = fn("euphonium", { notation: "valves", valveCount: 4 });
    for (const pitch of PITCHES) {expect(euphonium(pitch)).toBe(fn("euphonium", { notation: "valves" })(pitch));}
  });

  // Every pitch of the Bb and Eb tubas, including the low extension.
  it.each([["bb-tuba", 2], ["bass-eb-tuba", -3]] as const)("covers every pitch of %s", (id, shift) => {
    const four = fn(id, { notation: "valves", valveCount: 4 });
    const three = fn(id, { notation: "valves" });
    const semitones: Record<string, number> = { "1": 2, "2": 1, "3": 3, "4": 5 };
    const lowering = (combination: string) =>
      combination === "0" ? 0 : [...combination].reduce((sum, valve) => sum + semitones[valve], 0);
    for (const pitch of PITCHES) {
      const index = pitch + shift;
      const text = four(pitch);
      if (index < 25 || index > 62) {
        expect(text, `${pitch}`).toBe("");
        continue;
      }
      if (index < 30) {
        // The extension: each step a semitone below the open C (index 36).
        expect(lowering(text), `${pitch}`).toBe(36 - index);
      } else if (["13", "123"].includes(three(pitch))) {
        expect(text).toBe(three(pitch) === "13" ? "4" : "24");
        expect(lowering(text)).toBe(lowering(three(pitch)));
      } else {
        expect(text).toBe(three(pitch));
      }
    }
    expect(Object.keys(TUBA_4V_VALVES).length).toBe(38);
  });

  it("keeps positions in the shared range and writes valves below position 7", () => {
    for (const [id, shift] of [["bb-tuba", 2], ["bass-eb-tuba", -3]] as const) {
      const four = fn(id, { valveCount: 4 });
      const three = fn(id);
      for (const pitch of PITCHES) {
        const index = pitch + shift;
        if (index >= 30) {expect(four(pitch)).toBe(three(pitch));}
        else if (index >= 25) {expect(four(pitch)).toBe(TUBA_4V_VALVES[index]);}
      }
    }
    expect(fn("bb-tuba", { valveCount: 4 })(25 - 2)).toBe("1234");
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
