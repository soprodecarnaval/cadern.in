import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMATTING_PROFILE,
  zFormattingProfile,
  type FormattingProfile,
} from "../../../types/formattingProfile";
import {
  DEFAULT_SPACING,
  libraryOptionsFor,
  resolvePartFormatting,
  sheetLayoutFor,
} from "./profile";

describe("FormattingProfile", () => {
  it("accepts the minimal profile and rejects unknown versions and values", () => {
    expect(zFormattingProfile.parse({ profileVersion: 1 })).toEqual(DEFAULT_FORMATTING_PROFILE);
    expect(() => zFormattingProfile.parse({ profileVersion: 2 })).toThrow();
    expect(() => zFormattingProfile.parse({ profileVersion: 1, staffSize: 5 })).toThrow();
    expect(() =>
      zFormattingProfile.parse({ profileVersion: 1, fingering: { valveCount: 5 } }),
    ).toThrow();
  });

  it("defaults to automatic layout, positions and every clean-up rule", () => {
    const part = resolvePartFormatting(DEFAULT_FORMATTING_PROFILE, "Trompete");
    expect(part).toEqual({
      staffSize: "auto",
      systemsPerPage: "auto",
      spacing: DEFAULT_SPACING,
      fingering: {
        enabled: "byInstrument",
        notation: "positions",
        valveCount: 3,
        dynamicTrombone: false,
        size: "auto",
      },
      cleanup: { credits: true, fingerings: true, staffText: true },
    });
    expect(sheetLayoutFor(part)).toEqual({
      spacingLinear: 0.21,
      spacingNonLinear: 0.6,
      spacingSystem: 4,
    });
    expect(libraryOptionsFor(DEFAULT_FORMATTING_PROFILE)).toEqual({
      partPageStyle: "fitted",
      textFonts: "shared",
      fitArea: { widthMm: 171.7, heightMm: 98.2 },
    });
  });

  it("applies part overrides over score settings", () => {
    const profile: FormattingProfile = zFormattingProfile.parse({
      profileVersion: 1,
      staffSize: 1.6,
      spacing: { linear: 0.2 },
      fingering: { notation: "valves" },
      parts: {
        Tuba: { systemsPerPage: 3, spacing: { system: 6 }, fingering: { valveCount: 4 } },
      },
    });
    const tuba = resolvePartFormatting(profile, "Tuba");
    expect(sheetLayoutFor(tuba)).toEqual({
      staffSpaceMm: 1.6,
      systems: 3,
      spacingLinear: 0.2,
      spacingNonLinear: 0.6,
      spacingSystem: 6,
    });
    expect(tuba.fingering).toMatchObject({ notation: "valves", valveCount: 4 });
    expect(resolvePartFormatting(profile, "Flauta").fingering.valveCount).toBe(3);
  });
});
