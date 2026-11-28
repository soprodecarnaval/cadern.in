import { describe, expect, it, vi } from "vitest";
import { duplicateSongbook, freeSongbookSlug, type DuplicateSongbookServices } from "./duplicateSongbook";

const content = {
  entries: [
    { type: "section" as const, title: "Marchinhas", order: 0 },
    { type: "score" as const, scoreId: "outro-a", order: 1, index: 1 },
  ],
  pins: { "outro-a": "outro-a-r3" },
  covers: { trompete: { path: "projects/outro/songbooks/x/r/capa.png", url: "https://x/capa.png" } },
  print: { fallbacks: ["tuba" as const], backSheetPageNumber: true, antiAssedioPages: false },
};

function services(taken: string[] = []): DuplicateSongbookServices {
  return {
    getSongbookById: vi.fn((id: string) => Promise.resolve(id === "outro~carnaval"
      ? { id, title: "Carnaval", projectId: "outro", slug: "carnaval", currentRevisionId: "r3", isPublished: true, deletedAt: null }
      : null)) as unknown as DuplicateSongbookServices["getSongbookById"],
    getSongbookRevision: vi.fn(() => Promise.resolve({ id: "r3", revisionNumber: 3, ...content })) as unknown as DuplicateSongbookServices["getSongbookRevision"],
    getSongbook: vi.fn((_p: string, slug: string) => Promise.resolve(taken.includes(slug) ? { id: slug } : null)) as unknown as DuplicateSongbookServices["getSongbook"],
    createSongbook: vi.fn(() => Promise.resolve("id")),
  };
}

describe("freeSongbookSlug", () => {
  it("adds a numeric suffix on collision", async () => {
    const s = services(["copia-de-carnaval", "copia-de-carnaval-2"]);
    expect(await freeSongbookSlug("acervo", "Cópia de Carnaval", s.getSongbook)).toBe("copia-de-carnaval-3");
  });

  it("never returns a reserved or empty slug", async () => {
    const s = services();
    expect(await freeSongbookSlug("acervo", "Enviar", s.getSongbook)).toBe("enviar-caderninho");
    expect(await freeSongbookSlug("acervo", "!!!", s.getSongbook)).toBe("caderninho");
  });
});

describe("duplicateSongbook", () => {
  it("copies entries, pins, covers and print settings into the target project", async () => {
    const s = services();
    const result = await duplicateSongbook(
      { sourceId: "outro~carnaval", targetProjectId: "acervo", title: " Cópia de Carnaval ", createdBy: "u1" },
      s,
    );
    expect(result).toEqual({ projectId: "acervo", slug: "copia-de-carnaval" });
    expect(s.createSongbook).toHaveBeenCalledWith({
      projectId: "acervo",
      slug: "copia-de-carnaval",
      title: "Cópia de Carnaval",
      content,
      createdBy: "u1",
      note: "Cópia de outro/carnaval v3",
    });
  });

  it("fails for a missing songbook or an empty title", async () => {
    await expect(
      duplicateSongbook({ sourceId: "nada", targetProjectId: "acervo", title: "X", createdBy: "u1" }, services()),
    ).rejects.toThrow("Caderninho não encontrado.");
    await expect(
      duplicateSongbook({ sourceId: "outro~carnaval", targetProjectId: "acervo", title: "  ", createdBy: "u1" }, services()),
    ).rejects.toThrow("Dê um título");
  });
});
