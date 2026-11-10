import { describe, expect, it } from "vitest";
import type { ScoreViewModel, SongbookItemViewModel } from "../../types/viewModels";
import { identifySongbookItems } from "./songbookReorder";
import { destinationForIncomingScore, SONGBOOK_APPEND_ID } from "./crossColumnDnd";

const score = (id: string): SongbookItemViewModel => ({
  type: "score", score: { id, title: id } as ScoreViewModel,
});
const section = (title = "Axé"): SongbookItemViewModel => ({ type: "section", title });

describe("destinationForIncomingScore", () => {
  it("inserts before/after a score target", () => {
    const rows = [score("a"), score("b")];
    const entries = identifySongbookItems(rows, new WeakMap());
    expect(destinationForIncomingScore(rows, entries, entries[1].id, "before")).toBe(1);
    expect(destinationForIncomingScore(rows, entries, entries[1].id, "after")).toBe(2);
  });

  it("targeting a section header itself inserts at that section's start/end", () => {
    const rows = [section("A"), score("a"), score("b"), section("B"), score("c")];
    const entries = identifySongbookItems(rows, new WeakMap());
    expect(destinationForIncomingScore(rows, entries, entries[0].id, "before")).toBe(0);
    expect(destinationForIncomingScore(rows, entries, entries[0].id, "after")).toBe(3);
  });

  it("targeting a score inside a section inserts at that exact position, no carrying", () => {
    const rows = [section("A"), score("a"), score("b")];
    const entries = identifySongbookItems(rows, new WeakMap());
    expect(destinationForIncomingScore(rows, entries, entries[1].id, "before")).toBe(1);
    expect(destinationForIncomingScore(rows, entries, entries[1].id, "after")).toBe(2);
  });

  it("appends at the end for the empty-list droppable or an unknown target", () => {
    const rows = [score("a")];
    const entries = identifySongbookItems(rows, new WeakMap());
    expect(destinationForIncomingScore(rows, entries, SONGBOOK_APPEND_ID, "after")).toBe(1);
    expect(destinationForIncomingScore(rows, entries, undefined, "after")).toBe(1);
    expect(destinationForIncomingScore(rows, entries, "not-an-entry", "before")).toBe(1);
  });

  it("appends at the end of an empty songbook", () => {
    expect(destinationForIncomingScore([], [], SONGBOOK_APPEND_ID, "after")).toBe(0);
  });
});
