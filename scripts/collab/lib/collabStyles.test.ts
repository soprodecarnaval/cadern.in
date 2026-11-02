import { describe, expect, it } from "vitest";
import { DEFERRED_STYLE_SCORES, inferCarnivalStyle } from "./collabStyles";

describe("catalog style inference", () => {
  it("matches normalized titles and records all agreeing source IDs", () => {
    expect(inferCarnivalStyle({ id: "old", title: "ANUNCIAÇÃO!", tags: [""] }, [
      { id: "z", title: "Anunciacao", tags: ["Forró"] },
      { id: "a", title: "Anunciação", tags: ["forrós"] },
    ])).toEqual({ status: "inferred", style: "forrós", sourceScoreIds: ["a", "z"] });
  });
  it("preserves recognized styles rather than replacing them with another score's", () => {
    expect(inferCarnivalStyle({ id: "old", title: "Song", tags: [" Sambas "] }, [
      { id: "other", title: "Song", tags: ["axé"] },
    ])).toEqual({ status: "known", style: "samba", sourceScoreIds: [] });
  });
  it("reports conflicting evidence instead of choosing the most common style", () => {
    expect(inferCarnivalStyle({ id: "old", title: "Song", tags: ["Forma: AB"] }, [
      { id: "a", title: "Song", tags: ["samba"] },
      { id: "b", title: "Song", tags: ["samba"] },
      { id: "c", title: "Song", tags: ["axé"] },
    ])).toEqual({ status: "conflict", style: null, sourceScoreIds: ["a", "b", "c"] });
  });
  it("does not guess from similar titles, missing styles or circular matches", () => {
    expect(inferCarnivalStyle({ id: "old", title: "Song", tags: [""] }, [
      { id: "similar", title: "Song part two", tags: ["samba"] },
      { id: "missing", title: "Song", tags: [""] },
    ])).toEqual({ status: "missing", style: null, sourceScoreIds: [] });
  });
  it("retains the original 193-score review baseline", () => {
    expect(DEFERRED_STYLE_SCORES).toHaveLength(193);
    expect(new Set(DEFERRED_STYLE_SCORES.map((score) => score.scoreId)).size).toBe(193);
  });
});
