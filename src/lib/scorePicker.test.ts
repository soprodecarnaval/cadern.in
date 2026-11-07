import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import type { ScoreDoc, SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import type { WithId } from "./db";
import { groupScoreVersions, scoreSongbookSources } from "./scorePicker";

const score = (id: string, projectId = "carnaval-bh", parent?: string, time = 1) => ({
  id, projectId, title: "Abre Alas", createdAt: Timestamp.fromMillis(time),
  ...(parent ? { forkedFrom: { scoreId: parent, revisionId: "r1", projectId } } : {}),
}) as WithId<ScoreDoc>;
const groupIds = (docs: WithId<ScoreDoc>[], lineage = docs) =>
  groupScoreVersions(docs.map((doc) => ({ doc })), lineage)
    .map((group) => group.map(({ doc }) => doc.id));

describe("groupScoreVersions", () => {
  it("defaults to the newest descendant even when imported timestamps tie", () => {
    const old = score("2023");
    const middle = score("2024", "carnaval-bh", old.id);
    const latest = score("2026", "carnaval-bh", middle.id);
    latest.title = "Ó Abre Alas";
    expect(groupIds([old, latest, middle])).toEqual([["2026", "2024", "2023"]]);
    expect(latest.title).toBe("Ó Abre Alas");
  });

  it("keeps projects and unlinked arrangements with identical titles separate", () => {
    const a = score("a");
    const b = score("b", "garota", "a");
    const unrelated = score("unrelated");
    expect(groupIds([a, b, unrelated])).toEqual([["a"], ["b"], ["unrelated"]]);
  });

  it("retains lineage through deleted scores without offering them", () => {
    const a = score("a");
    const deleted = { ...score("deleted", "carnaval-bh", "a"), deletedAt: Timestamp.now() };
    const c = score("c", "carnaval-bh", "deleted");
    expect(groupIds([a, c], [a, deleted, c])).toEqual([["c", "a"]]);
  });

  it("orders sibling alternatives by creation time deterministically", () => {
    const a = score("a");
    const b = score("b", "carnaval-bh", "a", 2);
    const c = score("c", "carnaval-bh", "a", 3);
    expect(groupIds([a, b, c])).toEqual([["c", "b", "a"]]);
  });

  it("handles missing sources and cycles without hanging", () => {
    expect(groupIds([score("a", "carnaval-bh", "missing"), score("b", "carnaval-bh", "missing")]))
      .toEqual([["a", "b"]]);
    expect(groupIds([score("a", "carnaval-bh", "b"), score("b", "carnaval-bh", "a")]))
      .toEqual([["a", "b"]]);
  });
});

describe("scoreSongbookSources", () => {
  const book = (slug: string, pins: Record<string, string>, deleted = false) => ({
    book: { id: slug, projectId: "carnaval-bh", slug, deletedAt: deleted ? Timestamp.now() : null } as WithId<SongbookDoc>,
    revision: { pins } as SongbookRevisionDoc,
  });

  it("labels each historical score with its own source books", () => {
    const sources = scoreSongbookSources([
      book("2024", { old: "r1", shared: "r1" }),
      book("2026", { latest: "r2", shared: "r1" }),
    ]);
    expect(sources.get("old")).toEqual(["carnaval-bh/2024"]);
    expect(sources.get("latest")).toEqual(["carnaval-bh/2026"]);
    expect(sources.get("shared")).toEqual(["carnaval-bh/2024", "carnaval-bh/2026"]);
  });

  it("ignores deleted or missing books and deduplicates source labels", () => {
    expect([...scoreSongbookSources([
      book("2023", { a: "r1" }, true),
      { ...book("missing", {}), revision: null },
      book("2024", { b: "r1" }), book("2024", { b: "r1" }),
    ])]).toEqual([["b", ["carnaval-bh/2024"]]]);
  });
});
