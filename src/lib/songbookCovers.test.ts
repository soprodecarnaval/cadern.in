import { beforeEach, describe, expect, it, vi } from "vitest";
import { representativeCoverUrl, saveSongbookCovers } from "./songbookCovers";
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
    const saved = await saveSongbookCovers({
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
    expect(saved).toEqual(content.covers);
  });
});

describe("cover save failures and isolation", () => {
  const current = {
    entries: [], pins: { score: "pinned-r3" },
    covers: {
      flauta: { path: "fl.png", url: "fl" },
      trompete: { path: "tr.png", url: "tr" },
    },
  } as unknown as SongbookRevisionDoc;
  const input = {
    songbook: { id: "project~book", projectId: "project", title: "Book" } as WithId<SongbookDoc>,
    current,
    user: { uid: "owner" } as User,
  };

  it("removes only the selected instrument and preserves pins and other covers", async () => {
    const saved = await saveSongbookCovers({ ...input, added: new Map(), removed: ["flauta"] });
    expect(saved).toEqual({ trompete: current.covers.trompete });
    expect(createSongbookRevision).toHaveBeenCalledWith(input.songbook.id,
      { entries: current.entries, pins: current.pins, covers: saved }, expect.anything());
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(current.covers.flauta).toBeDefined();
  });

  it("rejects unsupported files before upload or revision creation", async () => {
    await expect(saveSongbookCovers({ ...input,
      added: new Map([["flauta", file("bad.gif", "image/gif")]]), removed: [],
    })).rejects.toThrow("PNG ou JPEG");
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(createSongbookRevision).not.toHaveBeenCalled();
  });

  it("does not create a revision after upload failure", async () => {
    vi.mocked(uploadBytes).mockRejectedValueOnce(new Error("offline"));
    await expect(saveSongbookCovers({ ...input,
      added: new Map([["flauta", file("cover.png")]]), removed: [],
    })).rejects.toThrow("offline");
    expect(createSongbookRevision).not.toHaveBeenCalled();
  });

  it("does not report success if creating the revision fails", async () => {
    vi.mocked(createSongbookRevision).mockRejectedValueOnce(new Error("write denied"));
    await expect(saveSongbookCovers({ ...input, added: new Map(), removed: ["flauta"] })).rejects.toThrow("write denied");
    expect(current.covers.flauta).toBeDefined();
  });
});

describe("representativeCoverUrl", () => {
  const file = (url: string) => ({ path: `p/${url}`, url });

  it("picks the first instrument in list order, not insertion order", () => {
    expect(
      representativeCoverUrl({ tuba: file("tuba"), flauta: file("flauta") }),
    ).toBe("flauta");
  });

  it("skips covers without a url", () => {
    expect(
      representativeCoverUrl({ bombardino: file(""), trombone: file("trombone") }),
    ).toBe("trombone");
  });

  it("is undefined when there are no covers", () => {
    expect(representativeCoverUrl({})).toBeUndefined();
  });
});
