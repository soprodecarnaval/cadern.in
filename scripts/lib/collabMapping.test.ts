import { describe, expect, it } from "vitest";
import { COLLAB_MAPPING, planAssignments, type CatalogMapping } from "./collabMapping";

const mapping: CatalogMapping[] = [
  { source: "old-2025", project: "band", title: "Band", songbook: "2025" },
  { source: "old-2026", project: "band", title: "Band", songbook: "2026" },
];
const projects = [{ id: "old-2025" }, { id: "old-2026" }];
const scores = [{ id: "a", projectId: "old-2025" }, { id: "b", projectId: "old-2026" }];

describe("collab project assignments", () => {
  it("uses the reviewed Carnaval BH and independent-group mapping", () => {
    expect(COLLAB_MAPPING.find((row) => row.source === "crack-carnaval-bh-2026")).toMatchObject({ project: "carnaval-bh", songbook: "crack-2026" });
    expect(COLLAB_MAPPING.find((row) => row.source === "blocae")).toMatchObject({ project: "blocae", songbook: "acervo" });
    expect(COLLAB_MAPPING.find((row) => row.source === "queimando-2024")).toMatchObject({ project: "queimando", songbook: "2024" });
    expect(COLLAB_MAPPING.find((row) => row.source === "festa-junina-2024")).toMatchObject({ project: "carnaval-bh", songbook: "festa-junina-2024" });
    expect(COLLAB_MAPPING.find((row) => row.source === "madeira-pirata")).toMatchObject({ songbook: null });
    expect(new Set(COLLAB_MAPPING.map((row) => row.source)).size).toBe(COLLAB_MAPPING.length);
  });
  it("keeps separate years after scores move and source projects are archived", () => {
    const original = planAssignments(projects, scores, [], mapping);
    expect(original.errors).toEqual([]);
    const resumed = planAssignments([
      { id: "old-2025", deletedAt: true }, { id: "old-2026", deletedAt: true }, { id: "band" },
    ], scores.map((score) => ({ ...score, projectId: "band" })), original.assignments, mapping);
    expect(resumed).toEqual(original);
  });
  it("does not resurrect previously deleted projects or their scores", () => {
    expect(planAssignments([{ id: "old-2025", deletedAt: true }], [scores[0]], [], mapping)).toEqual({ assignments: [], errors: [] });
  });
  it("rejects unknown projects and orphaned scores", () => {
    const plan = planAssignments([{ id: "unknown" }], [{ id: "x", projectId: "missing" }], [], mapping);
    expect(plan.errors).toEqual(["Unmapped project: unknown", "Unmapped score: x (missing)"]);
  });
  it("refuses unjournaled uploads into a destination instead of guessing their year", () => {
    const original = planAssignments(projects, scores, [], mapping);
    const plan = planAssignments([...projects, { id: "band" }], [...scores, { id: "new", projectId: "band" }], original.assignments, mapping);
    expect(plan.errors).toContain("Unmapped score: new (band)");
  });
  it("detects lost scores, unexpected moves and edited journal mappings", () => {
    const original = planAssignments(projects, scores, [], mapping).assignments;
    expect(planAssignments(projects, [], original, mapping).errors).toContain("Journal score missing: a");
    expect(planAssignments(projects, [{ id: "a", projectId: "elsewhere" }, scores[1]], original, mapping).errors).toContain("Score moved outside its mapping: a");
    expect(planAssignments(projects, scores, [{ ...original[0], songbook: "other" }], mapping).errors).toContain("Journal mapping changed: old-2025");
  });
  it("rejects duplicate songbooks in the mapping", () => {
    expect(() => planAssignments(projects, scores, [], [mapping[0], { ...mapping[1], songbook: "2025" }])).toThrow("Duplicate source project or destination songbook");
  });
});
