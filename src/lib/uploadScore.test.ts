import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { ParsedScore } from "./parseUploadedFiles";
import type { UploadTarget } from "./uploadTarget";
import { uploadScore } from "./uploadScore";
import { commitScoreRevision, createScore } from "./db";
import { ref, uploadBytes } from "firebase/storage";

vi.mock("../firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  uploadBytes: vi.fn().mockResolvedValue({}),
  getDownloadURL: vi.fn().mockResolvedValue("https://example.com/asset"),
}));
vi.mock("./db", () => ({
  commitScoreRevision: vi.fn().mockResolvedValue(undefined),
  createScore: vi.fn().mockResolvedValue(undefined),
  createProject: vi.fn(), getProject: vi.fn(), softDeleteScore: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
const user = { uid: "editor" } as User;
const parsed: ParsedScore = {
  title: "Abre Alas", composer: "", sub: "", tags: [], warnings: [],
  parts: [{ name: "Trompete", basename: "trompete", instrument: "trompete", svg: ["parts/trompete-1.svg"], midi: "parts/trompete.midi" }],
  fileMap: new Map(["mscz", "metajson", "midi", "parts/trompete-1.svg", "parts/trompete.midi"].map(key => [key, new File(["x"], key)])),
};

describe("project-scoped score uploads", () => {
  it("stores matched audio and timing with the part revision", async () => {
    const playback = { midi: "playback/trompete-playback.midi", timing: "playback/trompete-timing.json" };
    const arrangement = { svg: ["arrangement/arrangement-1.svg"], playback: { midi: "arrangement/full-playback.midi", timing: "arrangement/full-timing.json" } };
    const assets = [...Object.values(playback), ...arrangement.svg, ...Object.values(arrangement.playback)];
    const score: ParsedScore = {
      ...parsed,
      parts: [{ ...parsed.parts[0], playback }],
      arrangement,
      fileMap: new Map([...parsed.fileMap, ...assets.map(key => [key, new File(["x"], key)] as const)]),
    };
    const identity = await uploadScore(score, "destination", { kind: "new", scoreId: "new-score" }, user);
    const revision = vi.mocked(commitScoreRevision).mock.calls[0][2];
    const stored = revision.parts[0];
    const base = `projects/destination/scores/new-score/${identity.revisionId}`;
    expect(stored.playback).toEqual({
      midi: { path: `${base}/${playback.midi}`, url: "https://example.com/asset" },
      timing: { path: `${base}/${playback.timing}`, url: "https://example.com/asset" },
    });
    expect(revision.arrangement?.svg[0].path).toBe(`${base}/arrangement/arrangement-1.svg`);
    expect(revision.arrangement?.playback?.timing.path).toBe(`${base}/arrangement/full-timing.json`);
    expect(stored.midi.path).toBe(`${base}/parts/trompete.midi`);
  });

  it.each<UploadTarget>([
    { kind: "new", scoreId: "new-score" },
    { kind: "version", scoreId: "legacy-score-id", title: "Abre Alas" },
    { kind: "fork", scoreId: "fork-score", sourceTitle: "Abre Alas", sourceProjectTitle: "Other", source: { projectId: "other", scoreId: "original", revisionId: "r1" } },
  ])("uses the destination project's namespace for $kind uploads", async target => {
    const identity = await uploadScore(parsed, "destination", target, user);
    const base = `projects/destination/scores/${target.scoreId}/${identity.revisionId}`;
    const paths = vi.mocked(ref).mock.calls.map(call => call[1]);
    expect(paths).toEqual([
      `${base}/score.mscz`, `${base}/score.metajson`, `${base}/score.midi`,
      `${base}/parts/trompete-1.svg`, `${base}/parts/trompete.midi`,
    ]);
    expect(uploadBytes).toHaveBeenCalledTimes(5);
    const revision = vi.mocked(commitScoreRevision).mock.calls[0][2];
    expect(revision.mscz.path).toBe(`${base}/score.mscz`);
    expect(revision.parts[0].svg[0].path).toBe(`${base}/parts/trompete-1.svg`);
    expect(revision.parts[0].midi.path).toBe(`${base}/parts/trompete.midi`);
    expect(createScore).toHaveBeenCalledTimes(target.kind === "version" ? 0 : 1);
  });
});
