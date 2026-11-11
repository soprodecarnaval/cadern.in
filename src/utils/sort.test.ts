import { describe, expect, it } from "vitest";
import type { ScoreViewModel } from "../../types/viewModels";
import { restoreToLibrary } from "./sort";

function makeScore(id: string, title: string): ScoreViewModel {
  return {
    id,
    title,
    composer: "",
    sub: "",
    tags: [],
    projectId: "p1",
    projectTitle: "",
    latestRevision: {} as ScoreViewModel["latestRevision"],
  };
}

describe("restoreToLibrary", () => {
  const a = makeScore("a", "Amélia");
  const b = makeScore("b", "Brejeiro");
  const c = makeScore("c", "Carinhoso");
  const z = makeScore("z", "Zambeta");

  it("reinserts at the correct sorted position when a sort is active", () => {
    const results = [a, c]; // already sorted asc by title
    const restored = restoreToLibrary(results, [b], {
      column: "title",
      direction: "asc",
    });
    expect(restored.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("respects sort direction when reinserting", () => {
    const results = [c, a]; // already sorted desc by title
    const restored = restoreToLibrary(results, [b], {
      column: "title",
      direction: "desc",
    });
    expect(restored.map((s) => s.id)).toEqual(["c", "b", "a"]);
  });

  it("reinserts multiple scores at once, each at its sorted position", () => {
    const results = [a];
    const restored = restoreToLibrary(results, [z, c], {
      column: "title",
      direction: "asc",
    });
    expect(restored.map((s) => s.id)).toEqual(["a", "c", "z"]);
  });

  it("prepends unsorted when no sort is active", () => {
    const results = [a, c];
    const restored = restoreToLibrary(results, [b], null);
    expect(restored.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });
});
