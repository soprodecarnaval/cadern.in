import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScoreSession } from "../browserScore/types";
import { zFormattingProfile, type FormattingProfile } from "../../../types/formattingProfile";
import { resolvePartFormatting, sheetLayoutFor } from "./profile";
import { profileWithChoices, renderForUpload } from "./renderForUpload";
import { packageMscx } from "../msczIdentity";

afterEach(() => {vi.unstubAllGlobals();});

describe("profileWithChoices", () => {
  const parts = [{ ordinal: 1, name: "Trompete" }, { ordinal: 2, name: "Tuba" }];

  it("writes fingering choices as part overrides, keeping other settings", () => {
    const profile = zFormattingProfile.parse({ profileVersion: 1, parts: { Tuba: { staffSize: 1.5, fingering: { size: 1.1 } } } });
    const result = profileWithChoices(profile, parts, [
      { ordinal: 1, instrument: "trompete", fingerings: false },
      { ordinal: 2, instrument: "tuba", fingerings: true },
    ]);
    // Keyed by ordinal (023); the Tuba settings stored by name move to its ordinal.
    expect(result.parts).toEqual({
      "#1": { fingering: { enabled: false } },
      "#2": { staffSize: 1.5, fingering: { size: 1.1, enabled: true } },
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
    expect(sheetLayoutFor(resolvePartFormatting(restored, { ordinal: 1, name: "Trompete" })).fingeringScale).toBe(1.25);
    expect(sheetLayoutFor(resolvePartFormatting(restored, { ordinal: 2, name: "Tuba" })).fingeringScale).toBe(0.65);
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
      exportMusicXml: () => Promise.resolve({ musicXml: "<score-partwise/>", parts: [] }),
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
    expect(used!.parts?.["#1"]?.fingering?.enabled).toBe(false);
    expect(parsed.parts.map((p) => p.instrument)).toEqual(["trompete"]);
  });

  it("recovers manual edits from old SVGs and saves and reapplies them on reformat", async () => {
    vi.stubGlobal("DOMParser", DOMParser);
    vi.stubGlobal("XMLSerializer", XMLSerializer);
    const part = { id: "p1", ordinal: 1, name: "Trompete", origin: "existing" as const, instrumentNames: [], staffCount: null,
      instruments: [{ id: "bb-trumpet", soundId: null, longName: "Trompete", shortName: "Tpt." }], instrumentIds: ["bb-trumpet"] };
    const pages = ['<svg xmlns="http://www.w3.org/2000/svg" id="first"><g id="mark" class="fing"><text>1</text></g></svg>', '<svg id="second"/>'];
    const edited = pages[0].replace('class="fing"', 'class="fing" transform="translate(1 -2)"');
    const signedSvg = vi.fn(() => Promise.resolve(new Response(edited)));
    vi.stubGlobal("fetch", signedSvg);
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
      exportMusicXml: () => Promise.resolve({ musicXml: "<score-partwise/>", parts: [] }),
    } as unknown as ScoreSession;
    const mscx = new TextEncoder().encode('<museScore version="4.20"><Score/></museScore>');
    const format = zFormattingProfile.parse({
      profileVersion: 1, arrangementMarginMm: 12, arrangementStaffSizeMm: 2.8, arrangementStaffSpacing: 12,
    });
    const render = (profile = format) => renderForUpload(mscx, "Eva.mscx", profile,
      [{ ordinal: 1, instrument: "trompete" }], {
        legacyPartPages: new Map([["Trompete", "https://example.test/legacy.svg"]]),
        openSession: {
          session,
          catalog: { revision: 1, parts: [part], coverage: "complete", warnings: [] },
          renderer: { library: "l", engine: "e", renderer: "r", manifestSha256: "0".repeat(64), fonts: [] },
          useProfile: () => undefined,
        },
      });

    const { parsed } = await render();
    const [first, second] = parsed.parts[0].svg;
    expect(await parsed.fileMap.get(first)?.text()).toBe(edited);
    expect(await parsed.fileMap.get(second)?.text()).toBe(pages[1]);
    const playback = parsed.parts[0].playback!;
    expect(new Uint8Array(await parsed.fileMap.get(playback.midi)!.arrayBuffer())).toEqual(previewMidi);
    expect(JSON.parse(await parsed.fileMap.get(playback.timing)!.text())).toEqual({ version: 1, frames });
    expect(new Uint8Array(await parsed.fileMap.get(parsed.parts[0].midi)!.arrayBuffer())).toEqual(new Uint8Array([1]));
    expect(await parsed.fileMap.get("musicxml")?.text()).toBe("<score-partwise/>");
    expect(renderArrangement).toHaveBeenCalledWith(expect.objectContaining({ marginMm: 12, staffSizeMm: 2.8, staffSpacing: 12 }));
    expect(parsed.arrangement?.svg).toEqual(["arrangement/arrangement-1.svg"]);
    expect(await parsed.fileMap.get(parsed.arrangement!.svg[0])?.text()).toBe(pages[0]);
    expect(parsed.arrangement?.playback).toEqual({ midi: "arrangement/full-playback.midi", timing: "arrangement/full-timing.json" });
    const manifest = JSON.parse(await parsed.fileMap.get("metajson")!.text()) as { formatting: unknown };
    const profile = zFormattingProfile.parse(manifest.formatting);
    expect(profile.manualOffsets?.["1"]?.[0]).toMatchObject({ x: 1, y: -2, target: { id: "mark" } });

    const reformat = await render(profile);
    expect(await reformat.parsed.fileMap.get(first)?.text()).toBe(edited);
    expect(signedSvg).toHaveBeenCalledOnce();
  });

  it("stores the metadata the user checked instead of the file's tags", async () => {
    const part = { id: "p1", ordinal: 1, name: "Trompete", origin: "existing" as const, instrumentNames: [], staffCount: null,
      instruments: [{ id: "bb-trumpet", soundId: null, longName: "Trompete", shortName: "Tpt." }], instrumentIds: ["bb-trumpet"] };
    const session = {
      importInfo: { metaTags: { workTitle: "Eva", composer: "Anon", source: "Bloco", lyricist: "a, b" } },
      getPages: () => Promise.resolve({ revision: 1, pageCount: 1 }),
      renderPage: () => Promise.resolve({ svg: "<svg/>", warnings: [] }),
      exportMidi: () => Promise.resolve({ midi: new Uint8Array([1]), warnings: [] }),
      exportMusicXml: () => Promise.resolve({ musicXml: "<score-partwise/>", parts: [] }),
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

  it("files a part on another instrument's staff as the chosen instrument (025)", async () => {
    vi.stubGlobal("DOMParser", DOMParser);
    vi.stubGlobal("XMLSerializer", XMLSerializer);
    // A tenor sax part on a trumpet staff, sent as sax tenor.
    const part = { id: "p1", ordinal: 1, name: "SAX TENOR", origin: "existing" as const, instrumentNames: [], staffCount: null,
      instruments: [{ id: "", soundId: "brass.trumpet", longName: "Bb", shortName: "" }], instrumentIds: ["brass.trumpet"] };
    const playbackMidi = new Uint8Array([77, 84, 104, 100, 9]);
    const exportMidi = vi.fn(() => Promise.resolve({ midi: new Uint8Array([1]), warnings: [] }));
    const musicXml = '<score-partwise><part-list><score-part id="P1"><part-name>Bb</part-name></score-part></part-list>'
      + '<part id="P1"><measure number="1"><attributes><clef><sign>G</sign></clef></attributes></measure></part></score-partwise>';
    const session = {
      importInfo: { metaTags: { workTitle: "Abre alas" } },
      getPages: () => Promise.resolve({ revision: 1, pageCount: 1 }),
      renderPage: () => Promise.resolve({ svg: "<svg/>", warnings: [] }),
      getPartPlayback: () => Promise.resolve({ midi: playbackMidi, frames: [{ timeMs: 0, notes: ["n"] }] }),
      exportMidi,
      exportMusicXml: () => Promise.resolve({ musicXml, parts: [{ id: "P1", name: "Bb", instrumentNames: [], transposeChromatic: -2, catalogPart: { id: "p1", name: "SAX TENOR", origin: "existing" } }] }),
    } as unknown as ScoreSession;
    const mscx = new TextEncoder().encode('<museScore version="3.02"><Score/></museScore>');
    const { parsed, report } = await renderForUpload(mscx, "Abre alas.mscx", zFormattingProfile.parse({ profileVersion: 1 }),
      [{ ordinal: 1, instrument: "sax tenor" }], {
        openSession: {
          session,
          catalog: { revision: 1, parts: [part], coverage: "complete", warnings: [] },
          renderer: { library: "l", engine: "e", renderer: "r", manifestSha256: "0".repeat(64), fonts: [] },
          useProfile: () => undefined,
        },
      });
    expect(new Uint8Array(await parsed.fileMap.get(parsed.parts[0].midi)!.arrayBuffer())).toEqual(playbackMidi);
    expect(exportMidi).toHaveBeenCalledTimes(1); // the score MIDI only
    expect(report.parts[0].warnings.map((w) => w.code)).toContain("MIDI_FROM_PART_MUSICXML");
    const stored = await parsed.fileMap.get("musicxml")!.text();
    expect(stored).toContain("<part-name>Sax tenor</part-name>");
    expect(stored).toContain("<octave-change>-1</octave-change>");
  });
});
