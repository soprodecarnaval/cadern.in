import type { PlaybackFrame } from "./types";

/**
 * The part as Verovio lays it out without unrolling repeats: where each
 * measure starts, where the music ends, each notated note or rest as
 * [id, onMs, offMs], all on that straight-through timeline, and its MIDI
 * (base64) on the same timeline.
 */
export interface LinearPlayback {
  measureStartsMs: number[];
  endMs: number;
  notes: [string, number, number][];
  midi?: string;
}

/** One pass through a measure in MuseScore's playback: the measure (0-based) and when it starts. */
export interface PlayedMeasure {
  measure: number;
  timeMs: number;
}

/** MuseScore's play order: how many measures the score has, and each pass through one. */
export interface PlayOrder {
  measureCount: number;
  played: PlayedMeasure[];
}

/**
 * MuseScore's measure positions (webmscore savePositions(false)) as the order
 * the measures are played in, with repeats, endings and jumps unwound.
 * Null when the positions are missing or malformed.
 */
export function playOrder(raw: unknown): PlayOrder | null {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  const { elements, events } = (value ?? {}) as { elements?: unknown; events?: unknown };
  if (!Array.isArray(elements) || !Array.isArray(events) || !events.length) {return null;}
  const played: PlayedMeasure[] = [];
  for (const event of events as { elid?: unknown; position?: unknown }[]) {
    const measure = Number(event?.elid), timeMs = Number(event?.position);
    if (!Number.isInteger(measure) || measure < 0 || !Number.isFinite(timeMs) || timeMs < 0) {return null;}
    if (played.length && timeMs < played[played.length - 1].timeMs) {return null;}
    if (measure >= elements.length) {return null;}
    played.push({ measure, timeMs });
  }
  return { measureCount: elements.length, played };
}

const median = (values: number[]) => {
  if (!values.length) {return 1;}
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Something that sounds from `on` to `off`, in ms on a timeline. */
export interface Timed<T> {
  on: number;
  off: number;
  value: T;
}

/**
 * Lay out things on Verovio's straight-through timeline (notes, rests) along
 * MuseScore's play order. Each pass through a measure places what starts in
 * it at MuseScore's start time for the pass, stretched to MuseScore's length
 * for it, so tempo changes follow MuseScore. Something held over the barline
 * is cut at the end of the pass when the music jumps elsewhere after it.
 * Null when the two don't describe the same measures.
 */
export function placeInPlayOrder<T>(
  { measureStartsMs: starts, endMs }: Pick<LinearPlayback, "measureStartsMs" | "endMs">,
  { measureCount, played }: PlayOrder,
  items: readonly Timed<T>[],
): { placed: Timed<T>[]; endMs: number } | null {
  const count = starts.length;
  if (!count || count !== measureCount || !played.length || played.some(({ measure }) => measure >= count)) {return null;}
  const endOf = (measure: number) => (measure + 1 < count ? starts[measure + 1] : endMs);
  const lengthOf = (measure: number) => endOf(measure) - starts[measure];

  // Items by the measure they start in.
  const byMeasure: Timed<T>[][] = Array.from({ length: count }, () => []);
  for (const item of items) {
    let low = 0, high = count;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (starts[middle] <= item.on) {low = middle + 1;}
      else {high = middle;}
    }
    if (low > 0) {byMeasure[low - 1].push(item);}
  }

  // MuseScore's length for each pass; the last pass takes the usual stretch.
  const lengths = played.map((pass, i) => (i + 1 < played.length ? played[i + 1].timeMs - pass.timeMs : NaN));
  const stretch = median(lengths.flatMap((length, i) => {
    const own = lengthOf(played[i].measure);
    return Number.isFinite(length) && own > 0 ? [length / own] : [];
  }));
  lengths[lengths.length - 1] = lengthOf(played[played.length - 1].measure) * stretch;

  const placed: Timed<T>[] = [];
  played.forEach(({ measure, timeMs }, i) => {
    const own = lengthOf(measure);
    const scale = own > 0 ? lengths[i] / own : stretch;
    const passEnd = timeMs + lengths[i];
    const continues = played[i + 1]?.measure === measure + 1;
    for (const { on, off, value } of byMeasure[measure]) {
      const start = timeMs + (on - starts[measure]) * scale;
      let end = timeMs + (off - starts[measure]) * scale;
      if (!continues) {end = Math.min(end, passEnd);}
      placed.push({ on: start, off: Math.max(start, end), value });
    }
  });
  return { placed, endMs: played[played.length - 1].timeMs + lengths[lengths.length - 1] };
}

/** Playback frames (the notes sounding after each change) along MuseScore's play order. */
export function framesInPlayOrder(linear: LinearPlayback, order: PlayOrder): PlaybackFrame[] | null {
  const layout = placeInPlayOrder(linear, order, linear.notes.map(([id, on, off]) => ({ on, off, value: id })));
  if (!layout) {return null;}
  const events = layout.placed.flatMap(({ on, off, value }) => [{ timeMs: on, on: true, id: value }, { timeMs: off, on: false, id: value }]);
  // At the same moment, notes end before the next ones start.
  events.sort((a, b) => a.timeMs - b.timeMs || Number(a.on) - Number(b.on));

  const active = new Map<string, number>();
  const frames: PlaybackFrame[] = [];
  for (let i = 0; i < events.length;) {
    const timeMs = events[i].timeMs;
    for (; i < events.length && events[i].timeMs === timeMs; i++) {
      const { id, on } = events[i];
      const held = (active.get(id) ?? 0) + (on ? 1 : -1);
      if (held > 0) {active.set(id, held);}
      else {active.delete(id);}
    }
    frames.push({ timeMs: Math.round(timeMs * 10) / 10, notes: [...active.keys()] });
  }
  if (!frames.length || frames[frames.length - 1].notes.length) {frames.push({ timeMs: Math.round(layout.endMs * 10) / 10, notes: [] });}
  return frames;
}
