import type { PlaybackFrame } from "./types";

/** Where a system's staff sits on the page, in any one coordinate space. */
export interface CursorSystem {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * A notated note or rest: its horizontal centre, the system it is in, and,
 * when known, its measure's number in reading order and where that measure
 * ends (the barline).
 */
export interface CursorTarget {
  x: number;
  system: number;
  measure?: number;
  measureEnd?: number;
}

/** A point the cursor passes through: at `timeMs` it is at `x` on `system`. */
export interface CursorAnchor extends CursorTarget {
  timeMs: number;
}

export type CursorMotion = "smooth" | "step";

/**
 * One anchor per onset: the leftmost note or rest that starts in each frame.
 * Held notes don't move the cursor, so it keeps going through ties and long
 * notes. The last frame (everything off) ends the music at the last note's
 * barline, or the system's right edge.
 */
export function cursorAnchors(
  frames: readonly PlaybackFrame[],
  targetOf: (id: string) => CursorTarget | undefined,
  systems: readonly CursorSystem[],
): CursorAnchor[] {
  const anchors: CursorAnchor[] = [];
  let previous = new Set<string>();
  for (const frame of frames) {
    const started = frame.notes.filter((id) => !previous.has(id));
    previous = new Set(frame.notes);
    const targets = started.map(targetOf).filter((target): target is CursorTarget => !!target);
    if (!targets.length) {continue;}
    const first = targets.reduce((a, b) => (b.system < a.system || (b.system === a.system && b.x < a.x) ? b : a));
    anchors.push({ timeMs: frame.timeMs, ...first });
  }
  const last = anchors.at(-1);
  const end = frames.at(-1);
  if (last && end && end.timeMs > last.timeMs && systems[last.system]) {
    anchors.push({ timeMs: end.timeMs, x: last.measureEnd ?? systems[last.system].right, system: last.system });
  }
  return anchors;
}

/**
 * The cursor at a playback time, or null outside the music. Smooth motion
 * glides to the next onset when the music reads on from it: later on the
 * same system, in the same or the next measure. Otherwise (a new system, a
 * repeat, D.C. or D.S., or a skip forward past an ending or to the coda) it
 * glides to the current measure's barline, or the system's end, and jumps
 * from there, without passing over the music it skips. Step motion jumps
 * from onset to onset.
 */
export function cursorAt(
  anchors: readonly CursorAnchor[],
  systems: readonly CursorSystem[],
  milliseconds: number,
  motion: CursorMotion = "smooth",
): CursorAnchor | null {
  if (!anchors.length || milliseconds < anchors[0].timeMs || milliseconds > anchors[anchors.length - 1].timeMs) {return null;}
  let start = 0;
  let end = anchors.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (anchors[middle].timeMs <= milliseconds) {start = middle + 1;}
    else {end = middle;}
  }
  const current = anchors[start - 1];
  const next = anchors[start];
  if (motion === "step" || !next) {return { ...current, timeMs: milliseconds };}
  const readsOn = current.measure === undefined || next.measure === undefined
    || next.measure === current.measure || next.measure === current.measure + 1;
  const forward = readsOn && next.system === current.system && next.x >= current.x;
  const targetX = forward ? next.x : current.measureEnd ?? systems[current.system]?.right ?? current.x;
  const progress = (milliseconds - current.timeMs) / (next.timeMs - current.timeMs);
  return { timeMs: milliseconds, x: current.x + (targetX - current.x) * progress, system: current.system };
}
