import { describe, expect, it } from "vitest";
import { safeSpiralCut } from "./spiralCut";

// At the carousel's 62px spiral height a tile is ~30.29px and a loop's ring
// spans ~5.14–25.14px of it.
const H = 62;
const W = 30.29 * 10; // exactly 10 tiles: no spread between them

describe("safeSpiralCut", () => {
  it("keeps a cut that falls in the gap between two loops", () => {
    expect(safeSpiralCut(28, W, H)).toBe(28);
    expect(safeSpiralCut(30.29 * 3 + 2, W, H)).toBeCloseTo(30.29 * 3 + 2);
  });

  it("moves a cut through a loop to just before that loop", () => {
    const cut = safeSpiralCut(30.29 * 4 + 15, W, H);
    expect(cut).toBeCloseTo(30.29 * 4 + 5.14 - 1, 1);
  });

  it("moves a cut just inside a loop's left edge too", () => {
    const cut = safeSpiralCut(30.29 * 2 + 5.5, W, H);
    expect(cut).toBeCloseTo(30.29 * 2 + 5.14 - 1, 1);
  });

  it("accounts for the spread `space` adds between tiles", () => {
    // 10 tiles plus 18px spread over 9 gaps: 2px extra per gap.
    const width = W + 18;
    // Loop 5 starts at 5 * (30.29 + 2) + 5.14 ≈ 166.6.
    expect(safeSpiralCut(170, width, H)).toBeCloseTo(5 * 32.29 + 5.14 - 1, 1);
    // Just past loop 4's end (4 * 32.29 + 25.14 ≈ 154.3): already safe.
    expect(safeSpiralCut(156, width, H)).toBe(156);
  });

  it("cuts before the first loop when the cut falls in it", () => {
    expect(safeSpiralCut(10, W, H)).toBeCloseTo(5.14 - 1, 1);
  });
});
