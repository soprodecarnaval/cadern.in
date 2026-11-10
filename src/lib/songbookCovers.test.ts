import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSongbookCovers } from "./songbookCovers";
import { createSongbookRevision, type WithId } from "./db";
import { ref, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import type { SongbookDoc, SongbookRevisionDoc } from "../../types/docs";

vi.mock("../firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  uploadBytes: vi.fn().mockResolvedValue({}),
  getDownloadURL: vi.fn().mockResolvedValue("https://example.com/new-cover"),
}));
vi.mock("./db", () => ({
  createSongbookRevision: vi.fn().mockResolvedValue("r2"),
  newSongbookRevisionId: () => "r2",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const file = (name: string, type = "image/png") => new File(["x"], name, { type });

describe("project-scoped cover uploads", () => {
  it("stores new covers in the project namespace and preserves existing legacy covers", async () => {
    const oldCover = { path: "songbooks/acervo~carnaval/r1/covers/trombone.png", url: "https://example.com/legacy-cover" };
    const current = { entries: [], pins: { song: "r1" }, covers: { trombone: oldCover } } as unknown as SongbookRevisionDoc;
    await saveSongbookCovers({
      songbook: { id: "acervo~carnaval", projectId: "acervo", title: "Carnaval" } as WithId<SongbookDoc>,
      current,
      added: new Map([["trompete", file("trompete.png")]]),
      removed: [],
      user: { uid: "owner" } as User,
    });
    const path = "projects/acervo/songbooks/acervo~carnaval/r2/covers/trompete.png";
    expect(ref).toHaveBeenCalledWith(expect.anything(), path);
    expect(uploadBytes).toHaveBeenCalledTimes(1);
    const [songbookId, content, revision] = vi.mocked(createSongbookRevision).mock.calls[0];
    expect(songbookId).toBe("acervo~carnaval");
    expect(content.pins).toEqual(current.pins);
    expect(content.covers.trombone).toEqual(oldCover);
    expect(content.covers.trompete).toEqual({ path, url: "https://example.com/new-cover" });
    expect(revision.revisionId).toBe("r2");
  });
});
