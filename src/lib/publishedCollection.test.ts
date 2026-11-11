import { Timestamp } from "firebase/firestore";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDoc, ScoreDoc, ScoreRevisionDoc } from "../../types/docs";
import type { WithId } from "./db";
import { buildPublishedCollection } from "./publishedCollection";
import { createCollectionSearch } from "./collectionSearch";
import { restoreBuilderItems, storeBuilderItems } from "./builderStorage";

const time = Timestamp.fromMillis(1);
const projects: WithId<ProjectDoc>[] = ["bh", "garota", "na-tora"].map((id) => ({
  id, title: id, slug: id, memberIds: [], createdAt: time,
}));
const score = (id: string, projectId = "bh", parent?: string, created = 1): WithId<ScoreDoc> => ({
  id, projectId, title: "Abre Alas", composer: "", sub: "", tags: [],
  uploadedBy: "user", createdAt: Timestamp.fromMillis(created), latestRevisionId: "draft",
  published: { revisionId: "published", songbookIds: ["book"] },
  ...(parent ? { forkedFrom: { scoreId: parent, projectId: "bh", revisionId: "published" } } : {}),
});
const revision = (id: string): WithId<ScoreRevisionDoc> => ({
  id, revisionNumber: 1, uploadedBy: "user", uploadedAt: time, notes: "",
  mscz: { path: "", url: "" }, metajson: { path: "", url: "" }, midi: { path: "", url: "" }, parts: [],
});
const getRevision = (_scoreId: string, id: string) => Promise.resolve(revision(id));
const ids = (scores: { id: string }[]) => scores.map((s) => s.id);
afterEach(() => { vi.unstubAllGlobals(); });

describe("published search collection", () => {
  it("shows one newest descendant per project, retaining all published scores for restoration", async () => {
    const old = score("2020");
    const previous = score("2025", "bh", old.id);
    const latest = score("2026", "bh", previous.id);
    const collection = await buildPublishedCollection(projects, [old, previous, latest,
      score("garota", "garota", previous.id), score("na-tora", "na-tora", latest.id)], getRevision);
    expect(ids(collection.searchScores)).toEqual(["2026", "garota", "na-tora"]);
    expect(collection.allScores).toHaveLength(5);
    const search = createCollectionSearch(collection.searchScores);
    expect(ids(search.search("abre alas"))).toEqual(["2026", "garota", "na-tora"]);
    expect(ids(search.search(""))).toEqual(["2026", "garota", "na-tora"]);
    expect(search.getMatches("abre alas", latest.id)?.some((m) => m.key === "title")).toBe(true);
  });

  it("connects through unpublished/deleted intermediates but excludes ineligible candidates", async () => {
    const old = score("old");
    const middle = { ...score("middle", "bh", old.id), published: null };
    const deleted = { ...score("deleted", "bh", middle.id), deletedAt: time };
    const latest = score("latest", "bh", deleted.id);
    const draft = { ...score("draft", "bh", latest.id), published: null };
    const deadProject = { ...projects[0], id: "deleted-project", deletedAt: time };
    const read = vi.fn(getRevision);
    const collection = await buildPublishedCollection([...projects, deadProject], [old, middle, deleted,
      latest, draft, score("orphan", "missing"), score("hidden", deadProject.id)], read);
    expect(ids(collection.searchScores)).toEqual(["latest"]);
    expect(ids(collection.allScores)).toEqual(["old", "latest"]);
    expect(read.mock.calls).toEqual([["old", "published"], ["latest", "published"]]);
  });

  it("uses the pinned published revision and falls back when a descendant's pin is missing", async () => {
    const old = score("old");
    const latest = score("latest", "bh", old.id);
    const read = vi.fn((id: string, rev: string) => Promise.resolve(id === latest.id ? null : revision(rev)));
    const collection = await buildPublishedCollection(projects, [old, latest], read);
    expect(ids(collection.searchScores)).toEqual(["old"]);
    expect(collection.searchScores[0].latestRevision.id).toBe("published");
    expect(read.mock.calls).toEqual([["old", "published"], ["latest", "published"]]);
  });

  it("keeps unrelated same-title arrangements and chooses sibling ties deterministically", async () => {
    const root = score("root");
    const b = score("b", "bh", root.id, 2);
    const a = score("a", "bh", root.id, 2);
    const unrelated = score("independent");
    const collection = await buildPublishedCollection(projects, [root, b, a, unrelated], getRevision);
    expect(ids(collection.searchScores)).toEqual(["a", "independent"]);
    const later = { ...b, createdAt: Timestamp.fromMillis(3) };
    expect(ids((await buildPublishedCollection(projects, [root, a, later], getRevision)).searchScores)).toEqual(["b"]);
  });

  it("does not resurrect ancestors when only their old metadata matches", async () => {
    const old = { ...score("old"), title: "HistoricalOnly", tags: ["archivedonly"] };
    const latest = score("latest", "bh", old.id);
    const collection = await buildPublishedCollection(projects, [old, latest], getRevision);
    const search = createCollectionSearch(collection.searchScores);
    expect(search.search("HistoricalOnly")).toEqual([]);
    expect(search.search("archivedonly")).toEqual([]);
    expect(search.search("^bh")).toHaveLength(1);
    expect(search.search('"^abre alas"')).toHaveLength(1);
  });

  it("restores older builder entries without making them searchable", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const collection = await buildPublishedCollection(projects, [score("old"), score("latest", "bh", "old")], getRevision);
    storeBuilderItems([{ type: "score", score: collection.allScores[0] }]);
    const restored = restoreBuilderItems(collection.allScores);
    expect(restored).toEqual([{ type: "score", score: collection.allScores[0] }]);
    expect(ids(createCollectionSearch(collection.searchScores).search(""))).toEqual(["latest"]);
  });

  it("handles missing ancestors, cycles and an empty collection", async () => {
    const collection = await buildPublishedCollection(projects, [score("a", "bh", "b"),
      score("b", "bh", "a"), score("orphan", "garota", "missing")], getRevision);
    expect(ids(collection.searchScores)).toEqual(["a", "orphan"]);
    expect(await buildPublishedCollection(projects, [], getRevision)).toEqual({ allScores: [], searchScores: [] });
  });
});
