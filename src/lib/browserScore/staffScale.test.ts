import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS engine module, loaded in the worker at run time
import { verovioScale } from "./engine/renderer.js";

type Scale = { verovioUnit: number; zoom: number };
const scale = verovioScale as (unit: number) => Scale;

describe("verovioScale", () => {
  it("draws sizes Verovio accepts as they are", () => {
    expect(scale(12)).toEqual({ verovioUnit: 12, zoom: 1 });
    expect(scale(7.25)).toEqual({ verovioUnit: 7.25, zoom: 1 });
  });

  it("enlarges larger staff sizes, up to 8 mm, without passing Verovio's largest unit", () => {
    for (let unit = 12.25; unit <= 40; unit += 0.25) {
      const { verovioUnit, zoom } = scale(unit);
      expect(verovioUnit).toBeLessThanOrEqual(12);
      expect(Number.isInteger(Math.round(zoom * 100))).toBe(true);
      expect(verovioUnit * zoom).toBeCloseTo(unit, 9);
    }
    expect(scale(40).zoom).toBe(3.34);
  });
});
