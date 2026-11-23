import { describe, expect, it } from "vitest";
import { matchesEveryWord, normalizeSearchText } from "./searchText";

describe("normalizeSearchText", () => {
  it("drops accents and case", () => {
    expect(normalizeSearchText("Código É")).toBe("codigo e");
  });
});

describe("matchesEveryWord", () => {
  it("matches words in any order, ignoring accents", () => {
    expect(matchesEveryWord("marchinha carnaval", "Carnaval · Marchinhas")).toBe(true);
    expect(matchesEveryWord("codigo", "Código")).toBe(true);
  });

  it("needs every word", () => {
    expect(matchesEveryWord("frevo samba", "Frevos")).toBe(false);
  });

  it("matches anything with an empty query", () => {
    expect(matchesEveryWord("  ", "Frevos")).toBe(true);
  });
});
