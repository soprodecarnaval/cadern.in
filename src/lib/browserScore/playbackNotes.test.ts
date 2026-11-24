import { expect, it } from "vitest";
import { notesAtTime } from "./playbackNotes";

it("highlights chords, clears during rests and supports seeking back across a repeat", () => {
  const frames = [
    { timeMs: 250, notes: ["first", "chord"] },
    { timeMs: 500, notes: ["chord"] },
    { timeMs: 750, notes: [] },
    { timeMs: 1000, notes: ["first", "chord"] },
    { timeMs: 1500, notes: [] },
  ];
  expect(notesAtTime(frames, 0)).toEqual([]);
  expect(notesAtTime(frames, 0.25)).toEqual(["first", "chord"]);
  expect(notesAtTime(frames, 0.65)).toEqual(["chord"]);
  expect(notesAtTime(frames, 0.8)).toEqual([]);
  expect(notesAtTime(frames, 1)).toEqual(["first", "chord"]);
  expect(notesAtTime(frames, 1.5)).toEqual([]);
  expect(notesAtTime(frames, 0.25)).toEqual(["first", "chord"]);
  expect(notesAtTime(frames, null)).toEqual([]);
});
