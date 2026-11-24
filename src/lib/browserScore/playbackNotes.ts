import type { PlaybackFrame } from "./types";

const noNotes: readonly string[] = [];

/** Look up the last on/off change at the current playback time, including seeks. */
export function notesAtTime(frames: readonly PlaybackFrame[], seconds: number | null): readonly string[] {
  if (seconds === null) {return noNotes;}
  const milliseconds = seconds * 1000;
  let start = 0;
  let end = frames.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (frames[middle].timeMs <= milliseconds) {start = middle + 1;}
    else {end = middle;}
  }
  return frames[start - 1]?.notes ?? noNotes;
}
