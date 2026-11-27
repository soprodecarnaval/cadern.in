import { describe, expect, it } from "vitest";
import { midiInPlayOrder, midiNotes } from "./midiOrder";

// A one-track MIDI file (480 ticks a quarter) from [deltaTicks, ...bytes] events.
const midiFile = (events: number[][]) => {
  const body = events.flatMap(([delta, ...data]) => [delta < 128 ? delta : 0x80 | (delta >> 7), ...(delta < 128 ? [] : [delta & 0x7f]), ...data]);
  body.push(0, 0xff, 0x2f, 0);
  return Uint8Array.from([
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 0x01, 0xe0,
    0x4d, 0x54, 0x72, 0x6b, 0, 0, (body.length >> 8) & 0xff, body.length & 0xff, ...body,
  ]);
};
// Program 56 (trumpet), then C4 and D4 a quarter each: measures of one quarter at 120 bpm.
const twoMeasures = midiFile([[0, 0xc0, 56], [0, 0x90, 60, 80], [480, 0x80, 60, 0], [0, 0x90, 62, 80], [480, 0x80, 62, 0]]);
const linear = { measureStartsMs: [0, 500], endMs: 1000 };
const brief = (notes: ReturnType<typeof midiNotes>) => notes!.map(({ pitch, on, off }) => `${pitch}:${Math.round(on)}-${Math.round(off)}`);

describe("midiNotes", () => {
  it("reads notes through the tempo map", () => {
    expect(brief(midiNotes(twoMeasures))).toEqual(["60:0-500", "62:500-1000"]);
    // At 60 bpm a quarter lasts a second.
    const slow = midiFile([[0, 0xff, 0x51, 3, 0x0f, 0x42, 0x40], [0, 0x90, 60, 80], [480, 0x90, 60, 0]]);
    expect(brief(midiNotes(slow))).toEqual(["60:0-1000"]);
  });

  it("refuses what is not a MIDI file", () => {
    expect(midiNotes(Uint8Array.from([1, 2, 3]))).toBeNull();
  });
});

describe("midiInPlayOrder", () => {
  it("plays the measures in the given order, keeping the instrument", () => {
    // |: C :| D, with MuseScore playing the repeat.
    const order = { measureCount: 2, played: [{ measure: 0, timeMs: 0 }, { measure: 0, timeMs: 500 }, { measure: 1, timeMs: 1000 }] };
    const out = midiInPlayOrder(twoMeasures, linear, order)!;
    expect(brief(midiNotes(out))).toEqual(["60:0-500", "60:500-1000", "62:1000-1500"]);
    expect(midiNotes(out)!.every(({ channel, velocity }) => channel === 0 && velocity === 80)).toBe(true);
    // The program change is kept: 0xC0 56.
    expect(out.join(",")).toContain([0xc0, 56].join(","));
  });

  it("is null when the order doesn't fit the measures", () => {
    expect(midiInPlayOrder(twoMeasures, linear, { measureCount: 3, played: [{ measure: 0, timeMs: 0 }] })).toBeNull();
  });
});
