/* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.stringContaining() matchers are typed any. */
import type { User } from "firebase/auth";
import { describe, expect, it, vi } from "vitest";
import { commitUpload, prepareUpload, repinSongbook, uploadContextFromSearchParams, uploadPath } from "./uploadFlow";
import type { ParsedScore } from "./parseUploadedFiles";
import type { UploadTargetLookups } from "./uploadTarget";

const score = (id: string, projectId: string, extra: object = {}) => ({
  id, projectId, latestRevisionId: "r2", title: id, deletedAt: null, ...extra,
});
const services = () => ({
  getMemberRole: vi.fn().mockResolvedValue("editor" as const),
  getProject: vi.fn().mockResolvedValue({ id: "p", title: "Projeto", deletedAt: null }),
  getScore: vi.fn().mockImplementation((id: string) => Promise.resolve(
    id === "s" ? score("s", "p") : id === "q-s" ? score("q-s", "q") : id === "p-fork" ? score("p-fork", "p", { forkedFrom: { scoreId: "q-s" } }) : null)),
  getSongbookById: vi.fn().mockResolvedValue({ id: "sb", projectId: "p", title: "Caderninho", currentRevisionId: "br2", deletedAt: null }),
  getSongbookRevision: vi.fn().mockResolvedValue({ entries: [], pins: { s: "r1" }, covers: {} }),
  createSongbookRevision: vi.fn().mockResolvedValue(undefined),
  swapSongbookEntryToFork: vi.fn().mockResolvedValue(undefined),
});
const lookups = (s: ReturnType<typeof services>): UploadTargetLookups => ({
  getScore: s.getScore as UploadTargetLookups["getScore"],
  getScoreForks: vi.fn().mockImplementation((id: string) => Promise.resolve(id === "q-s" ? [score("p-fork", "p")] : [])),
  revisionExists: vi.fn().mockResolvedValue(true),
  projectTitle: vi.fn().mockResolvedValue("Outro"),
});
const parsed = (source?: { scoreId: string; revisionId: string }) =>
  ({ title: "Música", source, composer: "", sub: "", tags: [], parts: [], fileMap: new Map(), warnings: [] }) as ParsedScore;
const user = { uid: "uid" } as User;

describe("upload context on the web route", () => {
  it("reads the context from the query and builds the path back", () => {
    const context = uploadContextFromSearchParams("bloco", new URLSearchParams("partitura=s&versao=r2&caderninho=sb&scoreId=x"));
    expect(context).toEqual({ projectId: "bloco", scoreId: "s", expectedScoreRevisionId: "r2", songbookId: "sb" });
    expect(uploadPath(context)).toBe("/bloco/enviar?partitura=s&versao=r2&caderninho=sb");
    expect(uploadPath({ projectId: "bloco" })).toBe("/bloco/enviar");
  });
});

describe("reformat context", () => {
  it("round-trips through the query, and needs the score and the base revision", () => {
    const context = { projectId: "bloco", scoreId: "s", expectedScoreRevisionId: "r2", baseRevisionId: "r1", mode: "reformat" as const };
    const path = uploadPath(context);
    expect(path).toBe("/bloco/enviar?partitura=s&versao=r2&base=r1&modo=reformatar");
    expect(uploadContextFromSearchParams("bloco", new URLSearchParams(path.split("?")[1]))).toEqual(context);
    expect(uploadContextFromSearchParams("bloco", new URLSearchParams("partitura=s&modo=reformatar")).mode).toBeUndefined();
  });

  it("aborts a reformat whose file no longer belongs to the score", async () => {
    const s = services();
    const context = { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2", baseRevisionId: "r2", mode: "reformat" as const };
    expect(await prepareUpload(context, parsed({ scoreId: "s", revisionId: "r2" }), "uid", s, lookups(s))).toMatchObject({ ok: true });
    expect(await prepareUpload(context, parsed({ scoreId: "gone", revisionId: "x" }), "uid", s, lookups(s)))
      .toMatchObject({ ok: false, reason: expect.stringContaining("reformatação") });
  });

  it("treats a stored file without an identity as the base revision", async () => {
    const s = services();
    const context = { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2", baseRevisionId: "r1", mode: "reformat" as const };
    expect(await prepareUpload(context, parsed(), "uid", s, lookups(s))).toMatchObject({ ok: true, target: { kind: "version", scoreId: "s" } });
  });

  it("saves an edit of another project's score as a copy here (031)", async () => {
    const s = services();
    const l = lookups(s);
    (l.getScoreForks as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const context = { projectId: "p", scoreId: "q-s", baseRevisionId: "r2", mode: "reformat" as const };
    expect(await prepareUpload(context, parsed({ scoreId: "q-s", revisionId: "r2" }), "uid", s, l))
      .toMatchObject({ ok: true, target: { kind: "fork", source: { scoreId: "q-s", projectId: "q", revisionId: "r2" } } });
    // A second edit adds a version to the copy already here.
    expect(await prepareUpload(context, parsed({ scoreId: "q-s", revisionId: "r2" }), "uid", s, lookups(s)))
      .toMatchObject({ ok: true, target: { kind: "version", scoreId: "p-fork" } });
  });

  it("labels the new revision as a reformat", async () => {
    const s = services();
    const upload = vi.fn().mockResolvedValue({ scoreId: "s", revisionId: "r3" });
    const context = { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2", baseRevisionId: "r2", mode: "reformat" as const };
    await commitUpload(context, parsed({ scoreId: "s", revisionId: "r2" }), { kind: "version", scoreId: "s", title: "s" }, user, { services: s, upload, lookups: lookups(s) });
    expect(upload.mock.calls[0][4]).toMatchObject({ kind: "reformat" });
  });
});

describe("prepareUpload", () => {
  it("resolves a new version of the launching score", async () => {
    const s = services();
    const result = await prepareUpload({ projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2" }, parsed({ scoreId: "s", revisionId: "r2" }), "uid", s, lookups(s));
    expect(result).toMatchObject({ ok: true, target: { kind: "version", scoreId: "s" } });
    expect(result.ok && result.checks.targetMismatch).toBeUndefined();
  });

  it("aborts on a stale score", async () => {
    const s = services();
    expect(await prepareUpload({ projectId: "p", scoreId: "s", expectedScoreRevisionId: "r1" }, parsed(), "uid", s, lookups(s)))
      .toMatchObject({ ok: false, reason: expect.stringContaining("atualizada por outra pessoa") });
  });

  it("aborts on a stale songbook", async () => {
    const s = services();
    expect(await prepareUpload({ projectId: "p", songbookId: "sb", expectedSongbookRevisionId: "br1" }, parsed(), "uid", s, lookups(s)))
      .toMatchObject({ ok: false, reason: expect.stringContaining("O caderninho mudou") });
  });

  it("aborts for a non-member, and on a foreign score for someone without edit rights here", async () => {
    const s = services();
    s.getMemberRole.mockResolvedValue(null);
    expect(await prepareUpload({ projectId: "p" }, parsed(), "uid", s, lookups(s))).toMatchObject({ ok: false, reason: expect.stringContaining("permissão") });
    s.getMemberRole.mockResolvedValue("reviewer");
    expect(await prepareUpload({ projectId: "p", scoreId: "q-s", expectedScoreRevisionId: "r2", songbookId: "sb", expectedSongbookRevisionId: "br2" },
      parsed({ scoreId: "q-s", revisionId: "r2" }), "uid", s, lookups(s))).toMatchObject({ ok: false, reason: expect.stringContaining("permissão") });
  });

  it("aborts on a songbook of another project", async () => {
    const s = services();
    s.getSongbookById.mockResolvedValue({ id: "sb", projectId: "q", title: "Outro", currentRevisionId: "br2", deletedAt: null });
    expect(await prepareUpload({ projectId: "p", songbookId: "sb", expectedSongbookRevisionId: "br2" }, parsed(), "uid", s, lookups(s)))
      .toMatchObject({ ok: false, reason: "Caderninho não encontrado." });
  });

  it("sends a foreign score from a songbook to this project's fork, and flags a file of another score", async () => {
    const s = services();
    const context = { projectId: "p", scoreId: "q-s", expectedScoreRevisionId: "r2", songbookId: "sb", expectedSongbookRevisionId: "br2" };
    const fork = await prepareUpload(context, parsed({ scoreId: "q-s", revisionId: "r2" }), "uid", s, lookups(s));
    expect(fork).toMatchObject({ ok: true, target: { kind: "version", scoreId: "p-fork" } });
    expect(fork.ok && fork.checks.targetMismatch).toBeUndefined();
    const other = await prepareUpload({ projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2" }, parsed(), "uid", s, lookups(s));
    expect(other).toMatchObject({ ok: true, target: { kind: "new" }, checks: { targetMismatch: expect.stringContaining("uma partitura nova") } });
  });
});

describe("commitUpload", () => {
  it("uploads, then re-pins the launching songbook", async () => {
    const s = services();
    const upload = vi.fn().mockResolvedValue({ scoreId: "s", revisionId: "r3" });
    const context = { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2", songbookId: "sb", expectedSongbookRevisionId: "br2" };
    const result = await commitUpload(context, parsed({ scoreId: "s", revisionId: "r2" }), { kind: "version", scoreId: "s", title: "s" }, user, { services: s, upload, lookups: lookups(s) });
    expect(result).toMatchObject({ ok: true, repin: "updated", identity: { revisionId: "r3" } });
    expect(s.createSongbookRevision).toHaveBeenCalledWith("sb", { entries: [], pins: { s: "r3" }, covers: {} }, { createdBy: "uid", note: "atualiza: Música" });
  });

  it("moves the songbook entry to this project's copy instead of pinning it", async () => {
    const s = services();
    const upload = vi.fn().mockResolvedValue({ scoreId: "p-fork", revisionId: "f2" });
    const context = { projectId: "p", scoreId: "q-s", songbookId: "sb", expectedSongbookRevisionId: "br2", baseRevisionId: "r2", mode: "reformat" as const };
    const result = await commitUpload(context, parsed({ scoreId: "q-s", revisionId: "r2" }), { kind: "version", scoreId: "p-fork", title: "p-fork" }, user, { services: s, upload, lookups: lookups(s) });
    expect(result).toMatchObject({ ok: true, repin: "swapped" });
    expect(s.swapSongbookEntryToFork).toHaveBeenCalledWith("sb", "q-s", "p-fork");
    expect(s.createSongbookRevision).not.toHaveBeenCalled();
    s.swapSongbookEntryToFork.mockRejectedValueOnce(new Error("already in it"));
    expect(await repinSongbook(context, { scoreId: "p-fork", revisionId: "f3" }, "M", "uid", s)).toBe("swap-failed");
  });

  it("writes nothing when the context went stale or the target changed", async () => {
    const s = services();
    const upload = vi.fn();
    const stale = await commitUpload({ projectId: "p", scoreId: "s", expectedScoreRevisionId: "r1" }, parsed(), { kind: "new", scoreId: "p-musica" }, user, { services: s, upload, lookups: lookups(s) });
    expect(stale).toMatchObject({ ok: false });
    const moved = await commitUpload({ projectId: "p" }, parsed({ scoreId: "s", revisionId: "r2" }), { kind: "new", scoreId: "p-musica" }, user, { services: s, upload, lookups: lookups(s) });
    expect(moved).toMatchObject({ ok: false, reason: expect.stringContaining("destino") });
    expect(upload).not.toHaveBeenCalled();
    expect(s.createSongbookRevision).not.toHaveBeenCalled();
  });

  it("writes nothing when canceled during destination validation", async () => {
    const s = services();
    const upload = vi.fn();
    const controller = new AbortController();
    s.getMemberRole.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve("editor");
    });

    await expect(commitUpload(
      { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2" },
      parsed({ scoreId: "s", revisionId: "r2" }),
      { kind: "version", scoreId: "s", title: "s" },
      user,
      { services: s, upload, lookups: lookups(s), signal: controller.signal },
    )).rejects.toMatchObject({ name: "AbortError" });
    expect(upload).not.toHaveBeenCalled();
    expect(s.createSongbookRevision).not.toHaveBeenCalled();
  });

  it("skips the re-pin when the songbook moved on during the upload", async () => {
    const s = services();
    s.getSongbookById.mockResolvedValueOnce({ id: "sb", projectId: "p", title: "C", currentRevisionId: "br2", deletedAt: null });
    s.getSongbookById.mockResolvedValue({ id: "sb", projectId: "p", title: "C", currentRevisionId: "br3", deletedAt: null });
    expect(await repinSongbook({ projectId: "p", songbookId: "sb", expectedSongbookRevisionId: "br2" }, { scoreId: "s", revisionId: "r3" }, "M", "uid", s)).toBe("updated");
    expect(await repinSongbook({ projectId: "p", songbookId: "sb", expectedSongbookRevisionId: "br2" }, { scoreId: "s", revisionId: "r3" }, "M", "uid", s)).toBe("skipped-stale");
    expect(await repinSongbook({ projectId: "p" }, { scoreId: "s", revisionId: "r3" }, "M", "uid", s)).toBe("none");
  });
});
