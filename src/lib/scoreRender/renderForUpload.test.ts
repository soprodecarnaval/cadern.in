import { describe, expect, it } from "vitest";
import { zFormattingProfile } from "../../../types/formattingProfile";
import { resolvePartFormatting, sheetLayoutFor } from "./profile";
import { profileWithChoices } from "./renderForUpload";

describe("profileWithChoices", () => {
  const parts = [{ ordinal: 1, name: "Trompete" }, { ordinal: 2, name: "Tuba" }];

  it("writes fingering choices as part overrides, keeping other settings", () => {
    const profile = zFormattingProfile.parse({ profileVersion: 1, parts: { Tuba: { staffSize: 1.5, fingering: { size: 1.1 } } } });
    const result = profileWithChoices(profile, parts, [
      { ordinal: 1, instrument: "trompete", fingerings: false },
      { ordinal: 2, instrument: "tuba", fingerings: true },
    ]);
    expect(result.parts).toEqual({
      Trompete: { fingering: { enabled: false } },
      Tuba: { staffSize: 1.5, fingering: { size: 1.1, enabled: true } },
    });
    expect(profile.parts?.Trompete).toBeUndefined();
  });

  it("resolves separate sizes for rendering after the saved profile is read back", () => {
    const profile = zFormattingProfile.parse({
      profileVersion: 1,
      parts: { Trompete: { fingering: { size: 1.25 } }, Tuba: { fingering: { size: 0.65 } } },
    });
    const effective = profileWithChoices(profile, parts, [
      { ordinal: 1, instrument: "trompete", fingerings: true },
      { ordinal: 2, instrument: "tuba", fingerings: true },
    ]);
    const restored = zFormattingProfile.parse(JSON.parse(JSON.stringify(effective)));
    expect(restored.fingering?.size).toBeUndefined();
    expect(sheetLayoutFor(resolvePartFormatting(restored, "Trompete")).fingeringScale).toBe(1.25);
    expect(sheetLayoutFor(resolvePartFormatting(restored, "Tuba")).fingeringScale).toBe(0.65);
  });

  it("leaves the profile alone when no choice sets fingerings", () => {
    const profile = zFormattingProfile.parse({ profileVersion: 1 });
    expect(profileWithChoices(profile, parts, [{ ordinal: 1, instrument: "trompete" }])).toEqual(profile);
  });
});
