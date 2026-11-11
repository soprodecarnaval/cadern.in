import { describe, expect, it, vi } from "vitest";
import { compactScoreLineage, loadScoreLineage } from "./scoreLineage";

describe("score lineage", () => {
  it("walks ancestry and displays first-published songbooks root first", async () => {
    const getScore = vi.fn((id: string) => Promise.resolve({
      firstPublished: { songbookId: `book-${id}`, projectId: "project", publishedAt: null as never },
      forkedFrom: id === "root" ? undefined : { projectId: "p", scoreId: "root", revisionId: "revision" },
    }));
    const getBook = vi.fn((id: string) => Promise.resolve({ title: id }));
    expect(await loadScoreLineage("current", getScore, getBook))
      .toEqual(["book-root", "book-current"]);
  });

  it("stops on cycles and preserves unavailable entries", async () => {
    const getScore = vi.fn(() => Promise.resolve({
      firstPublished: null,
      forkedFrom: { projectId: "p", scoreId: "current", revisionId: "revision" },
    }));
    expect(await loadScoreLineage("current", getScore, () => Promise.resolve(null)))
      .toEqual(["Ainda não publicada"]);
    expect(getScore).toHaveBeenCalledTimes(1);
  });

  it("stops at missing ancestors", async () => {
    expect(await loadScoreLineage("missing", () => Promise.resolve(null), () => Promise.resolve(null))).toEqual([]);
  });

  it("distinguishes inaccessible songbooks from unpublished scores", async () => {
    expect(await loadScoreLineage("current", () => Promise.resolve({
      firstPublished: { songbookId: "hidden", projectId: "p", publishedAt: null as never },
      forkedFrom: undefined,
    }), () => Promise.resolve(null))).toEqual(["Caderninho indisponível"]);
  });

  it("shows at most three titles, retaining root and the two latest", () => {
    expect(compactScoreLineage(["root", "previous", "current"]))
      .toEqual(["root", "previous", "current"]);
    expect(compactScoreLineage(["root", "older", "previous", "current"]))
      .toEqual(["root", "(…)", "previous", "current"]);
    expect(compactScoreLineage([])).toEqual([]);
  });
});
