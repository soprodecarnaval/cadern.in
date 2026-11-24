import { describe, expect, it, vi } from "vitest";
import type { ScoreSession } from "../browserScore/types";
import { zFormattingProfile, type FormattingProfile } from "../../../types/formattingProfile";
import { resolvePartFormatting, sheetLayoutFor } from "./profile";
import { profileWithChoices, renderForUpload } from "./renderForUpload";
import { packageMscx } from "../msczIdentity";

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

  it("uses the edited SVG only for its matching page and rejects a stale original", async () => {
    const part = { id: "p1", ordinal: 1, name: "Trompete", origin: "existing" as const, instrumentNames: [], staffCount: null,
      instruments: [{ id: "bb-trumpet", soundId: null, longName: "Trompete", shortName: "Tpt." }], instrumentIds: ["bb-trumpet"] };
    const pages = ['<svg id="first"/>', '<svg id="second"/>'];
    const edited = '<svg id="first"><g id="note" class="note"/><g class="fing" transform="translate(1 -2)"/></svg>';
    const frames = [{ timeMs: 0, notes: ["note"] }, { timeMs: 500, notes: [] }];
    const previewMidi = new Uint8Array([77, 84, 104, 100]);
    const renderArrangement = vi.fn(() => Promise.resolve({ pages: [pages[0]], playback: { midi: previewMidi, frames } }));
    const session = {
      importInfo: { metaTags: { workTitle: "Eva" } },
      getPages: () => Promise.resolve({ revision: 1, pageCount: 2 }),
      renderPage: (_view: unknown, page: number) => Promise.resolve({ svg: pages[page - 1], warnings: [] }),
      renderArrangement,
      getPartPlayback: () => Promise.resolve({ midi: previewMidi, frames }),
      exportMidi: () => Promise.resolve({ midi: new Uint8Array([1]), warnings: [] }),
    } as unknown as ScoreSession;
    const mscx = new TextEncoder().encode('<museScore version="4.20"><Score/></museScore>');
    const render = (original: string) => renderForUpload(mscx, "Eva.mscx", zFormattingProfile.parse({
      profileVersion: 1, arrangementMarginMm: 12, arrangementStaffSizeMm: 2.8, arrangementStaffSpacing: 12,
    }),
      [{ ordinal: 1, instrument: "trompete" }], {
        editedPages: [{ ordinal: 1, page: 1, original, svg: edited }],
        openSession: {
          session,
          catalog: { revision: 1, parts: [part], coverage: "complete", warnings: [] },
          renderer: { library: "l", engine: "e", renderer: "r", manifestSha256: "0".repeat(64), fonts: [] },
          useProfile: () => undefined,
        },
      });

    const { parsed } = await render(pages[0]);
    const [first, second] = parsed.parts[0].svg;
    expect(await parsed.fileMap.get(first)?.text()).toBe(edited);
    expect(await parsed.fileMap.get(second)?.text()).toBe(pages[1]);
    const playback = parsed.parts[0].playback!;
    expect(new Uint8Array(await parsed.fileMap.get(playback.midi)!.arrayBuffer())).toEqual(previewMidi);
    expect(JSON.parse(await parsed.fileMap.get(playback.timing)!.text())).toEqual({ version: 1, frames });
    expect(new Uint8Array(await parsed.fileMap.get(parsed.parts[0].midi)!.arrayBuffer())).toEqual(new Uint8Array([1]));
    expect(renderArrangement).toHaveBeenCalledWith(expect.objectContaining({ marginMm: 12, staffSizeMm: 2.8, staffSpacing: 12 }));
    expect(parsed.arrangement?.svg).toEqual(["arrangement/arrangement-1.svg"]);
    expect(await parsed.fileMap.get(parsed.arrangement!.svg[0])?.text()).toBe(pages[0]);
    expect(parsed.arrangement?.playback).toEqual({ midi: "arrangement/full-playback.midi", timing: "arrangement/full-timing.json" });
    await expect(render('<svg id="stale"/>')).rejects.toThrow("A página foi redesenhada");
  });

  it("stores the metadata the user checked instead of the file's tags", async () => {
    const part = { id: "p1", ordinal: 1, name: "Trompete", origin: "existing" as const, instrumentNames: [], staffCount: null,
      instruments: [{ id: "bb-trumpet", soundId: null, longName: "Trompete", shortName: "Tpt." }], instrumentIds: ["bb-trumpet"] };
    const session = {
      importInfo: { metaTags: { workTitle: "Eva", composer: "Anon", source: "Bloco", lyricist: "a, b" } },
      getPages: () => Promise.resolve({ revision: 1, pageCount: 1 }),
      renderPage: () => Promise.resolve({ svg: "<svg/>", warnings: [] }),
      exportMidi: () => Promise.resolve({ midi: new Uint8Array([1]), warnings: [] }),
      dispose: () => Promise.resolve(),
    } as unknown as ScoreSession;
    const mscx = new TextEncoder().encode('<museScore version="4.20"><Score/></museScore>');
    const { parsed } = await renderForUpload(mscx, "Eva.mscx", zFormattingProfile.parse({ profileVersion: 1 }),
      [{ ordinal: 1, instrument: "trompete", fingerings: false }], {
        metadata: { title: "Eva (Rádio Táxi)", composer: "Michael Sullivan", sub: "Refrão", tags: ["axé", "frevo"] },
        openSession: {
          session,
          catalog: { revision: 1, parts: [part], coverage: "complete", warnings: [] },
          renderer: { library: "l", engine: "e", renderer: "r", manifestSha256: "0".repeat(64), fonts: [] },
          useProfile: () => undefined,
        },
      });
    expect([parsed.title, parsed.composer, parsed.sub, parsed.tags]).toEqual(["Eva (Rádio Táxi)", "Michael Sullivan", "Refrão", ["axé", "frevo"]]);
    const metajson = JSON.parse(await parsed.fileMap.get("metajson")!.text()) as Record<string, unknown>;
    expect([metajson.composer, metajson.previousSource, metajson.poet]).toEqual(["Michael Sullivan", "Refrão", "axé, frevo"]);
    expect(parsed.fileMap.get("mscz")!.name).toBe("Eva (Rádio Táxi).mscz");
    // The file itself is sent as it came.
    expect(new Uint8Array(await parsed.fileMap.get("mscz")!.arrayBuffer())).toEqual(packageMscx(mscx));
  });
});
