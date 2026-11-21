// SPDX-License-Identifier: GPL-3.0-only
// Part MIDI from the full-score MIDI, for parts whose engine MIDI is empty
// (parts saved by MuseScore 4). MuseScore writes a format-1 file with one
// track per staff, in score order, and the tempo, time and key signature map
// in the first track. A part's file is that map plus the part's tracks.

type Chunk = { type: string; data: Uint8Array };

const text = (bytes: Uint8Array, at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));

function chunks(bytes: Uint8Array): { header: Uint8Array; tracks: Chunk[] } {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 14 || text(bytes, 0, 4) !== 'MThd') {throw new Error('Not a MIDI file');}
    const headerLength = view.getUint32(4);
    const header = bytes.subarray(8, 8 + headerLength);
    const tracks: Chunk[] = [];
    for (let at = 8 + headerLength; at + 8 <= bytes.length;) {
        const length = view.getUint32(at + 4);
        if (at + 8 + length > bytes.length) {throw new Error('Truncated MIDI chunk');}
        tracks.push({ type: text(bytes, at, 4), data: bytes.subarray(at + 8, at + 8 + length) });
        at += 8 + length;
    }
    return { header, tracks: tracks.filter(chunk => chunk.type === 'MTrk') };
}

const variable = (value: number): number[] => {
    const out = [value & 0x7f];
    while ((value >>= 7)) {out.unshift((value & 0x7f) | 0x80);}
    return out;
};

/** The tempo, time signature and key signature meta events of a track, as a track of their own. */
export function conductorTrack(track: Uint8Array): Uint8Array {
    const out: number[] = [];
    let p = 0, tick = 0, last = 0, status = 0;
    const read = () => { let value = 0, byte; do { byte = track[p++]; value = (value << 7) | (byte & 0x7f); } while (byte & 0x80 && p < track.length); return value; };
    while (p < track.length) {
        tick += read();
        if (track[p] & 0x80) {status = track[p++];}
        if (status === 0xff) {
            const type = track[p++];
            const length = read();
            if ([0x51, 0x58, 0x59].includes(type)) {
                out.push(...variable(tick - last), 0xff, type, ...variable(length), ...track.subarray(p, p + length));
                last = tick;
            }
            p += length;
        } else if (status === 0xf0 || status === 0xf7) {
            const length = read();
            p += length;
        } else {
            const type = status & 0xf0;
            p += type === 0xc0 || type === 0xd0 ? 1 : 2;
        }
    }
    out.push(...variable(Math.max(0, tick - last)), 0xff, 0x2f, 0x00);
    return Uint8Array.from(out);
}

function file(header: Uint8Array, tracks: Uint8Array[]): Uint8Array {
    const size = 14 + tracks.reduce((sum, track) => sum + 8 + track.length, 0);
    const out = new Uint8Array(size);
    const view = new DataView(out.buffer);
    out.set([0x4d, 0x54, 0x68, 0x64]);
    view.setUint32(4, 6);
    view.setUint16(8, 1);
    view.setUint16(10, tracks.length);
    view.setUint16(12, new DataView(header.buffer, header.byteOffset, header.byteLength).getUint16(4));
    let at = 14;
    for (const track of tracks) {
        out.set([0x4d, 0x54, 0x72, 0x6b], at);
        view.setUint32(at + 4, track.length);
        out.set(track, at + 8);
        at += 8 + track.length;
    }
    return out;
}

/** Note-on events (velocity > 0) in a MIDI file. */
export function midiNoteCount(bytes: Uint8Array): number {
    let notes = 0;
    for (const { data } of chunks(bytes).tracks) {
        let p = 0, status = 0;
        const read = () => { let value = 0, byte; do { byte = data[p++]; value = (value << 7) | (byte & 0x7f); } while (byte & 0x80 && p < data.length); return value; };
        while (p < data.length) {
            read();
            if (data[p] & 0x80) {status = data[p++];}
            // `p += read()` would read p before read() advances it.
            if (status === 0xff) { p++; const length = read(); p += length; }
            else if (status === 0xf0 || status === 0xf7) { const length = read(); p += length; }
            else {
                const type = status & 0xf0;
                if (type === 0x90 && data[p + 1] > 0) {notes++;}
                p += type === 0xc0 || type === 0xd0 ? 1 : 2;
            }
        }
    }
    return notes;
}

/** Number of MTrk chunks in a MIDI file. */
export const midiTrackCount = (bytes: Uint8Array) => chunks(bytes).tracks.length;

/**
 * A MIDI file with the given tracks (0-based) of `score`, preceded by the
 * score's tempo map when the first track is not among them.
 */
export function extractTracks(score: Uint8Array, indexes: readonly number[]): Uint8Array {
    const { header, tracks } = chunks(score);
    if (!indexes.length || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= tracks.length)) {throw new Error('Track out of range');}
    const selected = [...indexes].sort((a, b) => a - b).map(index => tracks[index].data);
    return file(header, indexes.includes(0) ? selected : [conductorTrack(tracks[0].data), ...selected]);
}
