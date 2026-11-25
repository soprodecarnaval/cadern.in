import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMATTING_PROFILE,
  zFormattingProfile,
  type FormattingProfile,
} from "../../../types/formattingProfile";
import {
  DEFAULT_SPACING,
  keyedByOrdinal,
  partKey,
  libraryOptionsFor,
  resolvePartFormatting,
  sheetLayoutFor,
} from "./profile";

describe("FormattingProfile", () => {
  it("accepts the minimal profile and rejects unknown versions and values", () => {
    expect(zFormattingProfile.parse({ profileVersion: 1 })).toEqual(DEFAULT_FORMATTING_PROFILE);
    expect(() => zFormattingProfile.parse({ profileVersion: 2 })).toThrow();
    expect(() => zFormattingProfile.parse({ profileVersion: 1, staffSize: 8.05 })).toThrow();
    expect(zFormattingProfile.parse({ profileVersion: 1, staffSize: 8 }).staffSize).toBe(8);
    expect(() =>
      zFormattingProfile.parse({ profileVersion: 1, fingering: { notation: "keys" } }),
    ).toThrow();
    // Profiles saved with the former tuba valve count still load; the setting is gone.
    expect(zFormattingProfile.parse({ profileVersion: 1, fingering: { valveCount: 4 } }).fingering).toEqual({});
  });

  it("defaults to automatic layout, positions and every clean-up rule", () => {
    const part = resolvePartFormatting(DEFAULT_FORMATTING_PROFILE, { ordinal: 1, name: "Trompete" });
    expect(part).toEqual({
      staffSize: "auto",
      systemsPerPage: "auto",
      spacing: DEFAULT_SPACING,
      fingering: {
        enabled: "byInstrument",
        notation: "positions",
        dynamicTrombone: false,
        size: "auto",
      },
      cleanup: { credits: true, fingerings: true, staffText: true },
    });
    expect(sheetLayoutFor(part)).toEqual({
      spacingLinear: 0.21,
      spacingNonLinear: 0.6,
      evenNoteSpacing: true,
      spacingSystem: 4,
    });
    expect(libraryOptionsFor(DEFAULT_FORMATTING_PROFILE)).toEqual({
      partPageStyle: "fitted",
      textFonts: "shared",
      fitArea: { widthMm: 171.7, heightMm: 98.2 },
    });
  });

  it("round-trips even note spacing with an explicit off override", () => {
    const profile = zFormattingProfile.parse(JSON.parse(JSON.stringify({
      profileVersion: 1,
      spacing: { evenNoteSpacing: true },
      parts: { Tuba: { spacing: { evenNoteSpacing: false } } },
    })));
    expect(sheetLayoutFor(resolvePartFormatting(profile, { ordinal: 3, name: "Flauta" })).evenNoteSpacing).toBe(true);
    expect(resolvePartFormatting(profile, { ordinal: 2, name: "Tuba" }).spacing.evenNoteSpacing).toBe(false);
    expect(sheetLayoutFor(resolvePartFormatting(profile, { ordinal: 2, name: "Tuba" })).evenNoteSpacing).toBe(false);
  });

  it("applies part overrides over score settings", () => {
    const profile: FormattingProfile = zFormattingProfile.parse({
      profileVersion: 1,
      staffSize: 1.6,
      spacing: { linear: 0.2 },
      fingering: { notation: "valves" },
      parts: {
        Tuba: { systemsPerPage: 3, spacing: { system: 6 }, fingering: { dynamicTrombone: true } },
      },
    });
    const tuba = resolvePartFormatting(profile, { ordinal: 2, name: "Tuba" });
    expect(sheetLayoutFor(tuba)).toEqual({
      staffSpaceMm: 1.6,
      systems: 3,
      spacingLinear: 0.2,
      spacingNonLinear: 0.6,
      evenNoteSpacing: true,
      spacingSystem: 6,
    });
    expect(tuba.fingering).toMatchObject({ notation: "valves", dynamicTrombone: true });
    expect(resolvePartFormatting(profile, { ordinal: 3, name: "Flauta" }).fingering.dynamicTrombone).toBe(false);
  });

  it("moves settings stored by part name to the ordinal of every part with that name (023)", () => {
    const stored = zFormattingProfile.parse({ profileVersion: 1, parts: { Trompete: { staffSize: 2 }, Gone: { staffSize: 3 } } });
    const keyed = keyedByOrdinal(stored, [{ ordinal: 1, name: "Trompete" }, { ordinal: 3, name: "Trompete" }, { ordinal: 2, name: "Tuba" }]);
    expect(keyed.parts).toEqual({ Gone: { staffSize: 3 }, "#1": { staffSize: 2 }, "#3": { staffSize: 2 } });
    expect(partKey({ ordinal: 3 })).toBe("#3");
  });
});
