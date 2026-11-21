import { describe, expect, it } from "vitest";
import { zFormattingProfile } from "../../../../types/formattingProfile";
import { choicesFrom, formattingOf, hasOverride, partRows, withFingerings, withFormatting, withInstrument, withoutOverride } from "./enviarState";

const part = (ordinal: number, name: string, id: string, soundId: string | null = null, longName = name) =>
  ({ ordinal, name, instruments: id || soundId ? [{ id, soundId, longName, shortName: "" }] : [] });

describe("partRows", () => {
  const rows = partRows([
    part(1, "Flauta", "flute"),
    part(2, "Pete", "bb-trumpet"),
    part(3, "Bone", "tenor-trombone", "brass.trombone"),
    part(4, "Tuba Eb", "eb-tuba"),
    part(5, "Órgão", "pipe-organ"),
    part(6, "Sax Tenor", "", null),
  ]);

  it("maps by MuseScore id, then sound id, and files fingered parts as piratas", () => {
    expect(rows.map((row) => [row.instrument, row.fingerings, row.include])).toEqual([
      ["flauta", false, true],
      ["trompete pirata", true, true],
      ["trombone pirata", true, true],
      ["tuba eb", true, true],
      [null, false, false],
      ["sax tenor", false, true],
    ]);
    expect(rows[5].guessed).toBe(true);
    expect(rows[3].family).toBe("tuba");
  });

  it("switches pirata instruments with fingerings, and keeps the rule on a new instrument", () => {
    const off = withFingerings(rows[1], false);
    expect(off.instrument).toBe("trompete");
    expect(withFingerings(off, true).instrument).toBe("trompete pirata");
    expect(withFingerings(rows[0], true).fingerings).toBe(false);
    expect(withInstrument(rows[1], "trombone").instrument).toBe("trombone pirata");
    const picked = withInstrument(rows[4], "bombardino");
    expect([picked.instrument, picked.include]).toEqual(["bombardino", true]);
    expect(withInstrument(rows[0], null).include).toBe(false);
  });

  it("hands the included parts with an instrument to renderForUpload", () => {
    const choices = choicesFrom([{ ...rows[0], include: false }, ...rows.slice(1)]);
    expect(choices.map((choice) => choice.ordinal)).toEqual([2, 3, 4, 6]);
    expect(choices[0]).toEqual({ ordinal: 2, instrument: "trompete pirata", name: "Pete", fingerings: true });
  });
});

describe("formatting controls", () => {
  const profile = zFormattingProfile.parse({ profileVersion: 1, staffSize: 1.5, fingering: { notation: "valves" } });

  it("edits the score's settings or one part's, which inherits the rest", () => {
    const tuba = withFormatting(profile, "Tuba", { fingering: { valveCount: 4 } });
    expect(formattingOf(tuba, "Tuba").fingering).toEqual({ notation: "valves", valveCount: 4 });
    expect(formattingOf(tuba, "Tuba").staffSize).toBe(1.5);
    expect(formattingOf(tuba, null).fingering).toEqual({ notation: "valves" });
    expect(hasOverride(tuba, "Tuba")).toBe(true);
    const score = withFormatting(tuba, null, { staffSize: "auto", cleanup: { staffText: false } });
    expect(score.staffSize).toBe("auto");
    expect(score.cleanup).toEqual({ staffText: false });
    expect(zFormattingProfile.safeParse(score).success).toBe(true);
    expect(hasOverride(withoutOverride(tuba, "Tuba"), "Tuba")).toBe(false);
  });
});
