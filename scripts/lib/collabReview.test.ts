import { readFileSync } from "node:fs";
import { Timestamp } from "firebase/firestore";
import { describe, expect, it, vi } from "vitest";
import { REVIEWED_SCORES, planReviewedScores } from "./collabReview";
import { planSongbooks } from "./collabSongbooks";
import { planAssignments } from "./collabMapping";
import type { CollabCatalog } from "./collabCatalog";

const snapshot = JSON.parse(readFileSync(new URL("../../docs/milestones/collab-flow/reports/007-score-review/inputs/score-snapshot.json", import.meta.url), "utf8")) as {
  rows: { id: string; sourceProject: string; originalTitle: string; tags: string[]; latestRevisionId: string }[];
};

function catalogFromSnapshot(): CollabCatalog {
  const projects = new Map(snapshot.rows.map((row) => [row.sourceProject, { id: row.sourceProject, deletedAt: null }]));
  const scores = new Map(snapshot.rows.map((row) => [row.id, {
    id: row.id, projectId: row.sourceProject, title: row.originalTitle, tags: row.tags,
    latestRevisionId: row.latestRevisionId, deletedAt: null,
  }]));
  const views = new Map(snapshot.rows.map((row) => [row.id, {
    ...scores.get(row.id), composer: "", sub: "", projectTitle: row.sourceProject,
    latestRevision: { id: row.latestRevisionId, parts: [] },
  }]));
  return {
    projects, scores, views, members: [], books: new Map(), bookJournals: new Map(), scoreJournals: new Map(),
    baseline: new Set(scores.keys()), savedSources: new Set(),
    ...planAssignments([...projects.values()], [...scores.values()], []),
  } as unknown as CollabCatalog;
}

describe("reviewed catalog decisions", () => {
  it("exports the reviewed links, direct tags, inferred tags and exact exclusions", () => {
    const rows = [...REVIEWED_SCORES.values()];
    expect(rows).toHaveLength(1067);
    expect(rows.filter((row) => row.predecessor)).toHaveLength(587);
    expect(rows.filter((row) => row.styleKind === "reviewed")).toHaveLength(361);
    expect(rows.filter((row) => row.styleKind === "chain")).toHaveLength(14);
    expect(rows.filter((row) => row.deferred)).toHaveLength(33);
    expect(rows.filter((row) => row.excluded).map((row) => row.scoreId).sort()).toEqual([
      "garota-2025-pequenaeva", "garota-2025-tapaonaraba", "garota-2026-pequenaeva", "garota-2026-tapaonaraba",
    ]);
    for (const row of rows) {
      const visited = new Set<string>();
      let current = row;
      while (current.predecessor) {
        expect(visited.has(current.scoreId)).toBe(false);
        visited.add(current.scoreId);
        const source = REVIEWED_SCORES.get(current.predecessor.scoreId)!;
        expect(source.excluded).toBe(false);
        expect(source.project).toBe(current.predecessor.projectId);
        expect(source.revisionId).toBe(current.predecessor.revisionId);
        current = source;
      }
    }
  });

  it("validates the production snapshot and preserves historical title variations", () => {
    const catalog = catalogFromSnapshot();
    expect(planReviewedScores(catalog).errors).toEqual([]);
    expect(REVIEWED_SCORES.get("carnaval-bh-2024-prefixo-de-verao")).toMatchObject({ title: "prefixo de verão" });
    expect(REVIEWED_SCORES.get("carnaval-bh-2025-prefixodoverao")).toMatchObject({
      title: "prefixo do verão", predecessor: { scoreId: "carnaval-bh-2024-prefixo-de-verao", projectId: "carnaval-bh" },
    });
    expect(REVIEWED_SCORES.get("carnaval-bh-2024-abre-alas")?.predecessor?.scoreId).toBe("carnaval-bh-2023-abre-alas");
  });

  it("covers reviewed custom styles and reports the remaining 33 plus 7 approved retirements", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const catalog = catalogFromSnapshot();
      const before = JSON.stringify([...catalog.scores]);
      const plan = planSongbooks(catalog);
      expect(plan.errors).toEqual([]);
      expect(plan.deferred.map((row) => row.scoreId).sort()).toEqual([...REVIEWED_SCORES.values()].filter((row) => row.deferred).map((row) => row.scoreId).sort());
      expect(plan.omissions).toHaveLength(40);
      expect(plan.omissions.filter((id) => !plan.approvedOmissions.has(id))).toEqual([]);
      const sections = plan.books.flatMap((book) => book.content.entries.flatMap((entry) => entry.type === "section" ? [entry.title] : []));
      expect(sections).toEqual(expect.arrayContaining(["baião", "xote", "arrasta-pé", "tropicália", "manifestação", "zoeira", "pisadinha", "beatles"]));
      expect(JSON.stringify([...catalog.scores])).toBe(before);
    } finally { log.mockRestore(); }
  });

  it("rejects changed revisions, titles, metadata overrides and conflicting lineage", () => {
    const id = "carnaval-bh-2024-abre-alas";
    for (const patch of [
      { latestRevisionId: "new" }, { title: "renamed" },
      { metadataOverride: { tags: ["funk"] } },
      { forkedFrom: { scoreId: "other", revisionId: "1", projectId: "other" } },
    ]) {
      const catalog = catalogFromSnapshot();
      Object.assign(catalog.scores.get(id)!, patch);
      expect(planReviewedScores(catalog).errors.some((error) => error.includes(id))).toBe(true);
    }
    const catalog = catalogFromSnapshot();
    catalog.scores.get("carnaval-bh-2023-abre-alas")!.deletedAt = Timestamp.now();
    expect(planReviewedScores(catalog).errors).toContain(`Reviewed predecessor changed or missing: ${id} -> carnaval-bh-2023-abre-alas`);
  });
});
