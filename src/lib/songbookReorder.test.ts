import { describe, expect, it } from "vitest";
import type { ScoreViewModel, SongbookItemViewModel } from "../../types/viewModels";
import { identifySongbookItems, insertionIndex, reorderSongbookItems, moveSongbookEntry, songbookDragRange, songbookSectionRange } from "./songbookReorder";
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


describe("section blocks", () => {
  it("moves a section and every score up to the next header, keeping internal order", () => {
    const rows = [section("Axé"), score("a"), score("b"), section("Funk"), score("c"), section("Samba"), score("d")];
    const moved = moveSongbookEntry(rows, 0, rows.length);
    expect(moved).toEqual([rows[3], rows[4], rows[5], rows[6], rows[0], rows[1], rows[2]]);
    expect(moved[5]).toBe(rows[1]);
    expect(moved[6]).toBe(rows[2]);
    expect(rows[0]).toEqual(section("Axé"));
  });
  it("moves sections upward and identifies the last section without a trailing header", () => {
    const rows = [section("A"), score("a"), section("B"), score("b"), score("c")];
    expect(songbookDragRange(rows, 2)).toEqual({ start: 2, end: 5 });
    expect(songbookSectionRange(rows, 4)).toEqual({ start: 2, end: 5 });
    expect(moveSongbookEntry(rows, 2, 0)).toEqual([rows[2], rows[3], rows[4], rows[0], rows[1]]);
  });
  it("moves empty and duplicate-titled sections independently", () => {
    const rows = [section(), section(), score("a"), section()];
    expect(songbookDragRange(rows, 0)).toEqual({ start: 0, end: 1 });
    expect(moveSongbookEntry(rows, 0, rows.length)).toEqual([rows[1], rows[2], rows[3], rows[0]]);
    expect(moveSongbookEntry(rows, 1, 0)).toEqual([rows[1], rows[2], rows[0], rows[3]]);
  });
  it("does not split a destination section or drop inside the carried block", () => {
    const rows = [section("A"), score("a"), score("b"), section("B"), score("c"), score("d")];
    for (const boundary of [0, 1, 2, 3, 4, 5]) {
      expect(moveSongbookEntry(rows, 0, boundary)).toBe(rows);
    }
  });
  it("keeps leading unsectioned scores outside moved sections", () => {
    const rows = [score("intro"), section("A"), score("a"), section("B"), score("b")];
    expect(songbookSectionRange(rows, 0)).toEqual({ start: 0, end: 1 });
    expect(moveSongbookEntry(rows, 3, 0)).toBe(rows);
    expect(moveSongbookEntry(rows, 3, 1)).toEqual([rows[0], rows[3], rows[4], rows[1], rows[2]]);
  });
  it("still moves individual scores across section boundaries and into empty sections", () => {
    const rows = [section("Empty"), section("A"), score("a"), score("b")];
    expect(songbookDragRange(rows, 2)).toEqual({ start: 2, end: 3 });
    expect(moveSongbookEntry(rows, 2, 1)).toEqual([rows[0], rows[2], rows[1], rows[3]]);
    expect(moveSongbookEntry(rows, 3, 0)).toEqual([rows[3], rows[0], rows[1], rows[2]]);
  });
  it("retains frozen revision pins and deletion markers when saving a moved block", () => {
    const rows = [section("A"), score("a"), score("b"), section("B"), score("c")];
    const moved = moveSongbookEntry(rows, 0, rows.length);
    const content = toSongbookRevisionContent(moved);
    expect(content.pins).toEqual({ c: "c-pinned", a: "a-pinned", b: "b-pinned" });
    expect(moved[3]).toMatchObject({ deleted: true, revision: { id: "a-pinned" } });
    expect(content.entries.flatMap(e => e.type === "score" ? [[e.scoreId, e.index]] : [])).toEqual([["c", 1], ["a", 2], ["b", 3]]);
  });
  it("ignores missing, invalid and unchanged destinations", () => {
    const rows = [section(), score("a")];
    for (const [from, boundary] of [[-1, 0], [2, 0], [0, -1], [0, 3], [0, 0.5], [0, 2]]) {
      expect(moveSongbookEntry(rows, from, boundary)).toBe(rows);
    }
    expect(songbookDragRange(rows, -1)).toBeNull();
    expect(songbookSectionRange(rows, 2)).toBeNull();
  });
});
