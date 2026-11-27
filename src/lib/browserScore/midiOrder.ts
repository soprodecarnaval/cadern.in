// Re-sequence a straight-through MIDI file into MuseScore's play order, measure by
// measure, with the same placement as the playback frames (playbackOrder.ts), so
// what sounds and what is highlighted come from one layout.
import { placeInPlayOrder, type LinearPlayback, type PlayOrder, type Timed } from "./playbackOrder";

type Note = { channel: number; pitch: number; velocity: number };
type Track = { setup: number[][]; notes: Timed<Note>[] };

const OUTPUT_PPQ = 480;
// 120 bpm: a quarter note is 500 ms, so a tick is 500/480 ms.
const OUTPUT_TEMPO_US = 500_000;

const readVariable = (bytes: Uint8Array, at: number): [number, number] => {
  let value = 0, byte;
  do { byte = bytes[at++]; value = (value << 7) | (byte & 0x7f); } while (byte & 0x80 && at < bytes.length);
  return [value, at];
};
const variable = (value: number): number[] => {
  const out = [value & 0x7f];
  while ((value >>= 7)) {out.unshift((value & 0x7f) | 0x80);}
  return out;
};
const text = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

/**
 * Read a format 0 or 1 MIDI file: each track's notes in ms, through the file's
 * tempo map, and its other events (instrument, names, controls) to replay at
 * the start. Null for files this does not handle (SMPTE time, bad chunks).
 */
function readMidi(bytes: Uint8Array): Track[] | null {
  if (bytes.length < 14 || text(bytes, 0) !== "MThd") {return null;}
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const division = view.getUint16(12);
  if (division & 0x8000 || !division) {return null;}
  const raw: { tick: number; data: number[] }[][] = [];
  const tempos: { tick: number; us: number }[] = [];
  for (let at = 8 + view.getUint32(4); at + 8 <= bytes.length;) {
    const length = view.getUint32(at + 4);
    const end = at + 8 + length;
    if (end > bytes.length) {return null;}
    if (text(bytes, at) === "MTrk") {
      const events: { tick: number; data: number[] }[] = [];
      let p = at + 8, tick = 0, status = 0;
      while (p < end) {
        let delta;
        [delta, p] = readVariable(bytes, p);
        tick += delta;
        if (bytes[p] & 0x80) {status = bytes[p++];}
        if (status === 0xff) {
          const type = bytes[p++];
          let size;
          [size, p] = readVariable(bytes, p);
          const data = [...bytes.subarray(p, p + size)];
          p += size;
          if (type === 0x51 && size === 3) {tempos.push({ tick, us: (data[0] << 16) | (data[1] << 8) | data[2] });}
          else if (type !== 0x2f) {events.push({ tick, data: [0xff, type, ...variable(size), ...data] });}
        } else if (status === 0xf0 || status === 0xf7) {
          let size;
          [size, p] = readVariable(bytes, p);
          events.push({ tick, data: [status, ...variable(size), ...bytes.subarray(p, p + size)] });
          p += size;
        } else {
          const size = (status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0 ? 1 : 2;
          events.push({ tick, data: [status, ...bytes.subarray(p, p + size)] });
          p += size;
        }
      }
      raw.push(events);
    }
    at = end;
  }
  tempos.sort((a, b) => a.tick - b.tick);
  const msAt = (tick: number) => {
    let ms = 0, last = 0, us = 500_000;
    for (const tempo of tempos) {
      if (tempo.tick >= tick) {break;}
      ms += (tempo.tick - last) * us / division / 1000;
      last = tempo.tick;
      us = tempo.us;
    }
    return ms + (tick - last) * us / division / 1000;
  };
  return raw.map((events) => {
    const track: Track = { setup: [], notes: [] };
    const sounding = new Map<number, { on: number; velocity: number }[]>();
    for (const { tick, data } of events) {
      const type = data[0] & 0xf0, channel = data[0] & 0x0f;
      if (type === 0x90 && data[2] > 0) {
        const key = channel * 128 + data[1];
        sounding.set(key, [...(sounding.get(key) ?? []), { on: msAt(tick), velocity: data[2] }]);
      } else if (type === 0x80 || type === 0x90) {
        const key = channel * 128 + data[1];
        const started = sounding.get(key)?.shift();
        if (started) {track.notes.push({ on: started.on, off: msAt(tick), value: { channel, pitch: data[1], velocity: started.velocity } });}
      } else {
        track.setup.push(data);
      }
    }
    return track;
  });
}

/** Each note of a MIDI file, in ms: for checks and tests. */
export function midiNotes(bytes: Uint8Array): (Note & { on: number; off: number })[] | null {
  const tracks = readMidi(bytes);
  return tracks && tracks.flatMap(({ notes }) => notes.map(({ on, off, value }) => ({ ...value, on, off })))
    .sort((a, b) => a.on - b.on || a.pitch - b.pitch);
}

function writeMidi(tracks: { events: { tick: number; data: number[] }[] }[]): Uint8Array {
  const chunks = tracks.map(({ events }) => {
    const body: number[] = [];
    let last = 0;
    for (const { tick, data } of events) {
      body.push(...variable(tick - last), ...data);
      last = tick;
    }
    body.push(0x00, 0xff, 0x2f, 0x00);
    return body;
  });
  const out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 0xff, tracks.length & 0xff, (OUTPUT_PPQ >> 8) & 0xff, OUTPUT_PPQ & 0xff];
  for (const body of chunks) {
    out.push(0x4d, 0x54, 0x72, 0x6b, (body.length >>> 24) & 0xff, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff, ...body);
  }
  return Uint8Array.from(out);
}

/**
 * The MIDI file laid out in MuseScore's play order, at a fixed tempo with the
 * times already in place. Null when the file or the order can't be used.
 */
export function midiInPlayOrder(midi: Uint8Array, linear: Pick<LinearPlayback, "measureStartsMs" | "endMs">, order: PlayOrder): Uint8Array | null {
  const tracks = readMidi(midi);
  if (!tracks?.length) {return null;}
  const tickOf = (ms: number) => Math.max(0, Math.round(ms * OUTPUT_PPQ * 1000 / OUTPUT_TEMPO_US));
  const out: { events: { tick: number; data: number[] }[] }[] = [];
  for (const [index, track] of tracks.entries()) {
    const layout = placeInPlayOrder(linear, order, track.notes);
    if (!layout) {return null;}
    const notes = layout.placed.flatMap(({ on, off, value: { channel, pitch, velocity } }) => [
      { tick: tickOf(on), on: true, data: [0x90 | channel, pitch, velocity] },
      { tick: Math.max(tickOf(on), tickOf(off)), on: false, data: [0x80 | channel, pitch, 0] },
    ]);
    // At the same tick, notes end before the next ones start.
    notes.sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on));
    const tempo = index === 0 ? [{ tick: 0, data: [0xff, 0x51, 3, (OUTPUT_TEMPO_US >> 16) & 0xff, (OUTPUT_TEMPO_US >> 8) & 0xff, OUTPUT_TEMPO_US & 0xff] }] : [];
    out.push({ events: [...tempo, ...track.setup.map((data) => ({ tick: 0, data })), ...notes.map(({ tick, data }) => ({ tick, data }))] });
  }
  return writeMidi(out);
}
