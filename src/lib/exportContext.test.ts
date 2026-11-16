import { describe, expect, it, vi } from "vitest";
import { validateExportContext } from "./exportContext";

const services = () => ({
  getMemberRole: vi.fn().mockResolvedValue("editor" as const),
  getProject: vi.fn().mockResolvedValue({ id: "p", title: "Projeto", deletedAt: null }),
  getScore: vi.fn().mockResolvedValue({
    id: "s",
    projectId: "p",
    latestRevisionId: "r2",
    title: "Música",
    deletedAt: null,
  }),
  getSongbookById: vi.fn().mockResolvedValue({
    id: "sb",
    title: "Caderninho",
    currentRevisionId: "br2",
    deletedAt: null,
  }),
});

describe("validateExportContext", () => {
  it("resolves a project-only context for an editor", async () => {
    const result = await validateExportContext(
      { projectId: "p" },
      "uid",
      services(),
    );
    expect(result).toEqual({
      ok: true,
      resolved: {
        projectId: "p",
        projectTitle: "Projeto",
        scoreId: undefined,
        scoreTitle: undefined,
        songbookId: undefined,
        songbookTitle: undefined,
      },
    });
  });

  it("denies a non-editor", async () => {
    const s = services();
    s.getMemberRole.mockResolvedValue("reviewer");
    const result = await validateExportContext({ projectId: "p" }, "uid", s);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a project that doesn't exist or is deleted", async () => {
    const s = services();
    s.getProject.mockResolvedValue(null);
    expect(
      await validateExportContext({ projectId: "p" }, "uid", s),
    ).toMatchObject({ ok: false, reason: "Projeto não encontrado." });
  });

  it("resolves a score in-date and rejects one that moved on", async () => {
    const s = services();
    const fresh = await validateExportContext(
      { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2" },
      "uid",
      s,
    );
    expect(fresh).toMatchObject({ ok: true, resolved: { scoreTitle: "Música" } });

    const stale = await validateExportContext(
      { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r1" },
      "uid",
      s,
    );
    expect(stale).toMatchObject({ ok: false });
  });

  it("resolves a songbook in-date and rejects one that moved on", async () => {
    const s = services();
    const fresh = await validateExportContext(
      { projectId: "p", songbookId: "sb", expectedSongbookRevisionId: "br2" },
      "uid",
      s,
    );
    expect(fresh).toMatchObject({
      ok: true,
      resolved: { songbookTitle: "Caderninho" },
    });

    const stale = await validateExportContext(
      { projectId: "p", songbookId: "sb", expectedSongbookRevisionId: "br1" },
      "uid",
      s,
    );
    expect(stale).toMatchObject({ ok: false });
  });

  it("resolves a foreign score fine, authorized purely by the given project", async () => {
    const s = services();
    s.getScore.mockResolvedValue({
      id: "s",
      projectId: "outro-projeto",
      latestRevisionId: "r2",
      title: "Música de outro projeto",
      deletedAt: null,
    });
    const result = await validateExportContext(
      { projectId: "p", scoreId: "s", expectedScoreRevisionId: "r2" },
      "uid",
      s,
    );
    expect(result).toMatchObject({
      ok: true,
      resolved: { scoreTitle: "Música de outro projeto" },
    });
    expect(s.getMemberRole).toHaveBeenCalledWith("p", "uid");
  });
});
