import { describe, expect, it } from "vitest";
import { zFormattingProfile } from "../../../../types/formattingProfile";
import { choicesFrom, formattingOf, hasOverride, metadataFromTags, metadataProblem, partRows, tagsFromText, rowsFromStored, withFingerings, withFormatting, withFormattingForAll, withInstrument, withoutOverride } from "./enviarState";

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
    const tuba = withFormatting(profile, "Tuba", { fingering: { dynamicTrombone: true } });
    expect(formattingOf(tuba, "Tuba").fingering).toEqual({ notation: "valves", dynamicTrombone: true });
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

describe("rowsFromStored", () => {
  const rows = partRows([
    part(1, "Flauta", "flute"),
    part(2, "Pete", "bb-trumpet"),
    part(3, "Tuba", "bb-tuba"),
    part(4, "Bone", "trombone"),
  ]);

  it("restores the stored parts, instruments and fingerings, leaving the others out", () => {
    const profile = zFormattingProfile.parse({ profileVersion: 1, parts: { Tuba: { fingering: { enabled: false } } } });
    const restored = rowsFromStored(rows, [
      { name: "Pete", instrument: "trompete" },
      { name: "Tuba", instrument: "tuba" },
      { name: "Bone", instrument: "trombone pirata" },
    ], profile);
    expect(restored.map((row) => [row.name, row.include, row.instrument, row.fingerings])).toEqual([
      ["Flauta", false, "flauta", false],
      ["Pete", true, "trompete", false],
      ["Tuba", true, "tuba", false],
      ["Bone", true, "trombone pirata", true],
    ]);
  });

  it("keeps the mapped rows for revisions without a parts list", () => {
    expect(rowsFromStored(rows, [], zFormattingProfile.parse({ profileVersion: 1 }))).toEqual(rows);
  });
});

describe("metadataFromTags", () => {
  it("reads title, composer, source as Trecho and lyricist as tags", () => {
    expect(metadataFromTags({ workTitle: " Cilada ", composer: "Tim Maia", source: "Refrão", lyricist: "marcha, , frevo" }, "x.mscz"))
      .toEqual({ title: "Cilada", composer: "Tim Maia", sub: "Refrão", tags: ["marcha", "frevo"] });
  });
  it("falls back to the file name, with empty fields", () => {
    expect(metadataFromTags({}, "Eva.mscz")).toEqual({ title: "Eva", composer: "", sub: "", tags: [] });
  });
  it("splits typed tags and needs a title", () => {
    expect(tagsFromText(" a,b ,, ")).toEqual(["a", "b"]);
    expect(metadataProblem({ title: "  ", composer: "", sub: "", tags: [] })).toBe("Dê um título à partitura.");
    expect(metadataProblem({ title: "Eva", composer: "", sub: "", tags: [] })).toBeNull();
  });
});

describe("withFormattingForAll", () => {
  it("makes the same change to each named part, keeping their other settings", () => {
    const profile = zFormattingProfile.parse({ profileVersion: 1, parts: { Pete: { systemsPerPage: 2, fingering: { notation: "valves" } } } });
    const next = withFormattingForAll(profile, ["Pete", "Tuba"], { fingering: { size: 0.8 } });
    expect(next.parts).toEqual({ Pete: { systemsPerPage: 2, fingering: { notation: "valves", size: 0.8 } }, Tuba: { fingering: { size: 0.8 } } });
    expect(withFormattingForAll(profile, ["Pete", "Tuba"], { staffSize: "auto" }).parts?.Tuba).toEqual({ staffSize: "auto" });
  });
});

describe("withInstrument", () => {
  const [flute, trumpet] = partRows([
    { ordinal: 1, name: "Flauta", instruments: [{ id: "flute", soundId: null, longName: "Flauta", shortName: "" }] },
    { ordinal: 2, name: "Pete", instruments: [{ id: "bb-trumpet", soundId: null, longName: "Trompete", shortName: "" }] },
  ]);
  it("makes the part the chosen instrument, whatever the file declares", () => {
    const asTrumpet = withInstrument(flute, "trompete");
    expect([asTrumpet.instrument, asTrumpet.fingeringsAvailable, asTrumpet.fingerings, asTrumpet.family]).toEqual(["trompete pirata", true, true, "trumpet"]);
    const asFlute = withInstrument(trumpet, "flauta");
    expect([asFlute.instrument, asFlute.fingeringsAvailable, asFlute.fingerings, asFlute.family]).toEqual(["flauta", false, false, null]);
  });
  it("keeps piratas off when switching between instruments that have them", () => {
    const off = withFingerings(trumpet, false);
    expect(withInstrument(off, "trombone")).toMatchObject({ instrument: "trombone", fingerings: false, family: "trombone" });
  });
});
