import { describe, expect, it } from "vitest";
import type { ScoreViewModel } from "../../../../../types/viewModels";
import { filterOptions, filterScores, NO_FILTERS } from "./resultsFilter";

const score = (id: string, style: string, projectTitle: string) =>
  ({ id, tags: [style], projectTitle }) as unknown as ScoreViewModel;
const scores = [
  score("a", "marchinha", "Carnaval BH"),
  score("b", "frevo", "Carnaval BH"),
  score("c", "Frevo", "Besourinhos"),
];

describe("resultsFilter", () => {
  it("lists each style and arrangement once, in order", () => {
    expect(filterOptions(scores)).toEqual({
      styles: ["frevo", "marchinha"],
      projects: ["Besourinhos", "Carnaval BH"],
    });
  });

  it("keeps everything with no filters", () => {
    expect(filterScores(scores, NO_FILTERS)).toEqual(scores);
  });

  it("keeps any chosen style, and narrows further by arrangement", () => {
    expect(filterScores(scores, { styles: ["frevo", "marchinha"], projects: [] }).map((s) => s.id))
      .toEqual(["a", "b", "c"]);
    expect(filterScores(scores, { styles: ["frevo"], projects: ["Carnaval BH"] }).map((s) => s.id))
      .toEqual(["b"]);
  });
});
