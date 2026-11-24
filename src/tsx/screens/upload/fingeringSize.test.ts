import { describe, expect, it } from "vitest";
import { stepFingeringSize } from "./fingeringSize";

describe("stepFingeringSize", () => {
  it("steps in both directions from the automatic fit", () => {
    expect(stepFingeringSize(0.75, 1)).toBe(0.8);
    expect(stepFingeringSize(0.75, -1)).toBe(0.7);
  });

  it("clamps at the supported limits", () => {
    expect(stepFingeringSize(0.3, -1)).toBe(0.3);
    expect(stepFingeringSize(2, 1)).toBe(2);
    expect(stepFingeringSize(0.32, -1)).toBe(0.3);
    expect(stepFingeringSize(1.98, 1)).toBe(2);
  });

  it("steps from values in existing saved profiles", () => {
    expect(stepFingeringSize(0.725, 1)).toBe(0.775);
  });
});
