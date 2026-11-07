import { describe, expect, it } from "vitest";
import type { ScoreViewModel, SongbookItemViewModel } from "../../types/viewModels";
import { identifySongbookItems, insertionIndex, reorderSongbookItems } from "./songbookReorder";
import { toSongbookRevisionContent } from "./songbook";

const score = (id: string): SongbookItemViewModel => ({
  type: "score", score: { id, title: id, latestRevision: { id: `${id}-latest` } } as ScoreViewModel,
  revision: { id: `${id}-pinned` } as ScoreViewModel["latestRevision"], deleted: true,
});
const section = (title = "Axé"): SongbookItemViewModel => ({ type: "section", title });

describe("songbook reorder", () => {
  it("inserts forward and backward without swapping intervening rows", () => {
    expect(reorderSongbookItems(["a", "b", "c", "d"], 0, 3)).toEqual(["b", "c", "d", "a"]);
    expect(reorderSongbookItems(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });
  it("moves only the section header, preserving the songs' relative order", () => {
    const rows = [section("Axé"), score("a"), score("b"), section("Funk"), score("c")];
    expect(reorderSongbookItems(rows, 0, 3)).toEqual([rows[1], rows[2], rows[3], rows[0], rows[4]]);
    expect(rows[0]).toEqual(section("Axé"));
  });
  it("moves songs into empty sections and before the first header", () => {
    const rows = [section("Empty"), section("Axé"), score("a")];
    expect(reorderSongbookItems(rows, 2, insertionIndex(2, 0, "after")))
      .toEqual([rows[0], rows[2], rows[1]]);
    expect(reorderSongbookItems(rows, 2, insertionIndex(2, 0, "before")))
      .toEqual([rows[2], rows[0], rows[1]]);
  });
  it("preserves complete entries and pins while save numbering follows the new order", () => {
    const a = score("a"); const b = score("b");
    const rows = [a, section(), b];
    const moved = reorderSongbookItems(rows, 2, 0);
    expect(moved[0]).toBe(b);
    expect(moved[1]).toBe(a);
    expect(moved[0]).toMatchObject({ deleted: true, revision: { id: "b-pinned" } });
    const content = toSongbookRevisionContent(moved);
    expect(content.pins).toEqual({ b: "b-pinned", a: "a-pinned" });
    expect(content.entries).toEqual([
      { type: "score", scoreId: "b", order: 0, index: 1 },
      { type: "score", scoreId: "a", order: 1, index: 2 },
      { type: "section", title: "Axé", order: 2 },
    ]);
  });
  it("ignores unchanged, missing and invalid destinations", () => {
    const rows = [score("a"), section()];
    for (const [from, to] of [[0, 0], [-1, 0], [0, -1], [2, 0], [0, 2], [0, 0.5]]) {
      expect(reorderSongbookItems(rows, from, to)).toBe(rows);
    }
    expect(reorderSongbookItems([], 0, 0)).toEqual([]);
  });
});

describe("stable editor identities", () => {
  it("distinguishes duplicate/empty section headings and retains IDs across moves", () => {
    const rows = [section(), section(), section(""), score("a")];
    const cache = new WeakMap<SongbookItemViewModel, string>();
    let n = 0;
    const first = identifySongbookItems(rows, cache, () => String(++n));
    expect(new Set(first.map(r => r.id)).size).toBe(4);
    const moved = identifySongbookItems(reorderSongbookItems(rows, 0, 3), cache);
    expect(moved.map(r => r.id)).toEqual([first[1].id, first[2].id, first[3].id, first[0].id]);
  });
  it("retains score identity after a metadata edit, without serializing UI IDs", () => {
    const a = score("a");
    const cache = new WeakMap<SongbookItemViewModel, string>();
    const first = identifySongbookItems([a], cache);
    const edited = { ...a };
    expect(identifySongbookItems([edited], cache)[0].id).toBe(first[0].id);
    expect(toSongbookRevisionContent([edited])).not.toHaveProperty("id");
    expect(a).not.toHaveProperty("id");
  });
});
