import { describe, expect, it, vi } from "vitest";
import type { ScoreSession } from "../browserScore/types";
import { zFormattingProfile, type FormattingProfile } from "../../../types/formattingProfile";
import { resolvePartFormatting, sheetLayoutFor } from "./profile";
import { profileWithChoices, renderForUpload } from "./renderForUpload";

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

describe("renderForUpload with the preview session", () => {
  it("reuses the open session: no library, the final profile first, and the session stays open", async () => {
    const calls: string[] = [];
    const part = { id: "p1", ordinal: 1, name: "Trompete", origin: "existing" as const, instrumentNames: [], staffCount: null,
      instruments: [{ id: "bb-trumpet", soundId: null, longName: "Trompete", shortName: "Tpt." }], instrumentIds: ["bb-trumpet"] };
    const session = {
      importInfo: { metaTags: { workTitle: "Eva" } },
      getPages: () => { calls.push("getPages"); return Promise.resolve({ revision: 1, pageCount: 1 }); },
      renderPage: () => { calls.push("renderPage"); return Promise.resolve({ svg: "<svg/>", warnings: [] }); },
      exportMidi: () => { calls.push("exportMidi"); return Promise.resolve({ midi: new Uint8Array([1]), warnings: [] }); },
      dispose: () => { calls.push("dispose"); return Promise.resolve(); },
    } as unknown as ScoreSession;
    const createLibrary = vi.fn();
    let used: FormattingProfile | null = null;
    const mscx = new TextEncoder().encode('<museScore version="4.20"><Score/></museScore>');
    const { parsed } = await renderForUpload(mscx, "Eva.mscx", zFormattingProfile.parse({ profileVersion: 1 }),
      [{ ordinal: 1, instrument: "trompete", fingerings: false }], {
        createLibrary,
        openSession: {
          session,
          catalog: { revision: 1, parts: [part], coverage: "complete", warnings: [] },
          renderer: { library: "l", engine: "e", renderer: "r", manifestSha256: "0".repeat(64), fonts: [] },
          useProfile: (profile) => { used = profile; calls.push("useProfile"); },
        },
      });
    expect(createLibrary).not.toHaveBeenCalled();
    expect(calls[0]).toBe("useProfile");
    expect(calls).not.toContain("dispose");
    expect(used!.parts?.Trompete?.fingering?.enabled).toBe(false);
    expect(parsed.parts.map((p) => p.instrument)).toEqual(["trompete"]);
  });
});
