import { describe, expect, it } from "vitest";
import { cursorAnchors, cursorAt, type CursorTarget } from "./playbackCursor";

const systems = [
  { left: 0, right: 100, top: 0, bottom: 10 },
  { left: 0, right: 100, top: 20, bottom: 30 },
];
const targets: Record<string, CursorTarget> = {
  a: { x: 10, system: 0 },
  b: { x: 50, system: 0 },
  c: { x: 5, system: 1 },
};
const frames = [
  { timeMs: 0, notes: ["a"] },
  { timeMs: 1000, notes: ["b"] },
  // b is held: no new onset, no anchor.
  { timeMs: 1500, notes: ["b"] },
  { timeMs: 2000, notes: ["c"] },
  { timeMs: 3000, notes: [] },
];
const anchors = cursorAnchors(frames, (id) => targets[id], systems);

describe("cursorAnchors", () => {
  it("anchors each onset and ends at the last system's right edge", () => {
    expect(anchors).toEqual([
      { timeMs: 0, x: 10, system: 0 },
      { timeMs: 1000, x: 50, system: 0 },
      { timeMs: 2000, x: 5, system: 1 },
      { timeMs: 3000, x: 100, system: 1 },
    ]);
  });
});

describe("cursorAt", () => {
  it("glides between onsets on the same system", () => {
    expect(cursorAt(anchors, systems, 500)).toMatchObject({ x: 30, system: 0 });
  });

  it("runs to the end of the system before the next system's onset", () => {
    expect(cursorAt(anchors, systems, 1500)).toMatchObject({ x: 75, system: 0 });
    expect(cursorAt(anchors, systems, 2000)).toMatchObject({ x: 5, system: 1 });
  });

  it("runs to the barline, not backwards, before a repeat on the same system", () => {
    const repeat = cursorAnchors(
      [{ timeMs: 0, notes: ["a"] }, { timeMs: 1000, notes: ["b"] }, { timeMs: 2000, notes: ["a"] }, { timeMs: 3000, notes: [] }],
      (id) => ({ a: { x: 10, system: 0, measureEnd: 30 }, b: { x: 50, system: 0, measureEnd: 70 } })[id],
      systems,
    );
    expect(cursorAt(repeat, systems, 1500)).toMatchObject({ x: 60, system: 0 });
    expect(cursorAt(repeat, systems, 2000)).toMatchObject({ x: 10, system: 0 });
    // The music ends at the last note's barline.
    expect(repeat.at(-1)).toMatchObject({ timeMs: 3000, x: 30 });
  });

  it("jumps over skipped measures instead of gliding across them", () => {
    // a ends measure 0; c, two measures on, is where the second ending starts.
    const skip = cursorAnchors(
      [{ timeMs: 0, notes: ["a"] }, { timeMs: 1000, notes: ["c"] }, { timeMs: 2000, notes: ["d"] }, { timeMs: 3000, notes: [] }],
      (id) => ({
        a: { x: 10, system: 0, measure: 0, measureEnd: 20 },
        c: { x: 50, system: 0, measure: 2, measureEnd: 60 },
        d: { x: 55, system: 0, measure: 2, measureEnd: 60 },
      })[id],
      systems,
    );
    expect(cursorAt(skip, systems, 500)).toMatchObject({ x: 15, system: 0 });
    expect(cursorAt(skip, systems, 1000)).toMatchObject({ x: 50, system: 0 });
    // Within the measure it reads on as usual.
    expect(cursorAt(skip, systems, 1500)).toMatchObject({ x: 52.5, system: 0 });
  });

  it("glides into the next measure as usual", () => {
    const next = cursorAnchors(
      [{ timeMs: 0, notes: ["a"] }, { timeMs: 1000, notes: ["b"] }, { timeMs: 2000, notes: [] }],
      (id) => ({ a: { x: 10, system: 0, measure: 0, measureEnd: 30 }, b: { x: 50, system: 0, measure: 1, measureEnd: 70 } })[id],
      systems,
    );
    expect(cursorAt(next, systems, 500)).toMatchObject({ x: 30, system: 0 });
  });

  it("stays on the onset in step motion", () => {
    expect(cursorAt(anchors, systems, 1500, "step")).toMatchObject({ x: 50, system: 0 });
  });

  it("is null outside the music", () => {
    expect(cursorAt(anchors, systems, -1)).toBeNull();
    expect(cursorAt(anchors, systems, 3001)).toBeNull();
    expect(cursorAt([], systems, 0)).toBeNull();
  });
});
