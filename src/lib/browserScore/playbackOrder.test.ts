import { describe, expect, it } from "vitest";
import { framesInPlayOrder, playOrder, type LinearPlayback, type PlayedMeasure } from "./playbackOrder";

// Three one-second measures, one whole note each: a, b, c.
const linear: LinearPlayback = {
  measureStartsMs: [0, 1000, 2000],
  endMs: 3000,
  notes: [["a", 0, 1000], ["b", 1000, 2000], ["c", 2000, 3000]],
};
const order = (played: PlayedMeasure[], measureCount = 3) => ({ measureCount, played });
const onsets = (frames: ReturnType<typeof framesInPlayOrder>) =>
  frames!.filter((frame) => frame.notes.length).map((frame) => `${frame.notes.join("+")}@${frame.timeMs}`);

describe("playOrder", () => {
  const elements = [{ id: 0 }, { id: 1 }];
  it("reads MuseScore's positions, as JSON text or an object", () => {
    const raw = { elements, events: [{ elid: 0, position: 0 }, { elid: 1, position: 500 }, { elid: 0, position: 1000 }] };
    const expected = { measureCount: 2, played: [{ measure: 0, timeMs: 0 }, { measure: 1, timeMs: 500 }, { measure: 0, timeMs: 1000 }] };
    expect(playOrder(raw)).toEqual(expected);
    expect(playOrder(JSON.stringify(raw))).toEqual(expected);
  });

  it("refuses missing or malformed positions", () => {
    expect(playOrder(undefined)).toBeNull();
    expect(playOrder("not json")).toBeNull();
    expect(playOrder({ elements, events: [] })).toBeNull();
    expect(playOrder({ events: [{ elid: 0, position: 0 }] })).toBeNull();
    expect(playOrder({ elements, events: [{ elid: -1, position: 0 }] })).toBeNull();
    expect(playOrder({ elements, events: [{ elid: 2, position: 0 }] })).toBeNull();
    expect(playOrder({ elements, events: [{ elid: 0, position: 500 }, { elid: 1, position: 0 }] })).toBeNull();
  });
});

describe("framesInPlayOrder", () => {
  it("plays the measures in MuseScore's order, repeats and skips included", () => {
    // |: a :| then a jump straight to c: a a c.
    const frames = framesInPlayOrder(linear, order([{ measure: 0, timeMs: 0 }, { measure: 0, timeMs: 1000 }, { measure: 2, timeMs: 2000 }]));
    expect(onsets(frames)).toEqual(["a@0", "a@1000", "c@2000"]);
    expect(frames!.at(-1)).toEqual({ timeMs: 3000, notes: [] });
  });

  it("stretches each pass to MuseScore's length for it", () => {
    // MuseScore plays b slower (a ritardando): two seconds instead of one.
    const frames = framesInPlayOrder(
      { measureStartsMs: [0, 1000], endMs: 2000, notes: [["a", 0, 1000], ["b1", 1000, 1500], ["b2", 1500, 2000]] },
      order([{ measure: 0, timeMs: 0 }, { measure: 1, timeMs: 1000 }, { measure: 0, timeMs: 3000 }], 2),
    );
    expect(onsets(frames)).toEqual(["a@0", "b1@1000", "b2@2000", "a@3000"]);
  });

  it("cuts a note held over the barline when the music jumps after it", () => {
    // a is tied into the next measure; the second time, the music goes to c instead.
    const tied: LinearPlayback = { ...linear, notes: [["a", 0, 1500], ["b", 1500, 2000], ["c", 2000, 3000]] };
    const frames = framesInPlayOrder(tied, order([{ measure: 0, timeMs: 0 }, { measure: 1, timeMs: 1000 }, { measure: 0, timeMs: 2000 }, { measure: 2, timeMs: 3000 }]));
    // The first time it is held into b's measure, until b starts.
    expect(frames).toContainEqual({ timeMs: 1500, notes: ["b"] });
    expect(frames!.find((frame) => frame.timeMs === 1000)).toBeUndefined();
    // The second time it stops at the jump, as c starts.
    expect(frames).toContainEqual({ timeMs: 3000, notes: ["c"] });
    expect(frames!.filter((frame) => frame.timeMs > 3000).every((frame) => !frame.notes.includes("a"))).toBe(true);
  });

  it("is null when MuseScore and the layout don't have the same measures", () => {
    expect(framesInPlayOrder(linear, order([{ measure: 0, timeMs: 0 }], 4))).toBeNull();
    expect(framesInPlayOrder(linear, order([{ measure: 3, timeMs: 0 }]))).toBeNull();
    expect(framesInPlayOrder(linear, order([]))).toBeNull();
  });
});
