import { test } from 'vitest';
import assert from 'node:assert/strict';
import { conductorTrack, extractTracks, midiNoteCount, midiTrackCount } from './midi';

const chunk = (type: string, data: number[]) => [...type].map(c => c.charCodeAt(0)).concat([data.length >>> 24, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255], data);
const end = [0x00, 0xff, 0x2f, 0x00];
// Track 0: name, tempo, time signature, a note (with running status), then a key signature later.
const track0 = [0x00, 0xff, 0x03, 0x02, 0x41, 0x42, 0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, 0x00, 0xff, 0x58, 0x04, 0x02, 0x02, 0x18, 0x08,
    0x00, 0x90, 0x3c, 0x40, 0x83, 0x60, 0x3c, 0x00, 0x10, 0xff, 0x59, 0x02, 0x01, 0x00, ...end];
const track1 = [0x00, 0xc0, 0x38, 0x00, 0x91, 0x40, 0x40, 0x60, 0x81, 0x40, 0x00, ...end];
const track2 = [0x00, 0x92, 0x43, 0x40, 0x60, 0x82, 0x43, 0x00, ...end];
const score = Uint8Array.from([...chunk('MThd', [0, 1, 0, 3, 0x01, 0xe0]), ...chunk('MTrk', track0), ...chunk('MTrk', track1), ...chunk('MTrk', track2)]);

test('the conductor track keeps tempo, time and key signatures at their ticks', () => {
    assert.deepEqual([...conductorTrack(Uint8Array.from(track0))], [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, 0x00, 0xff, 0x58, 0x04, 0x02, 0x02, 0x18, 0x08,
        0x83, 0x70, 0xff, 0x59, 0x02, 0x01, 0x00, 0x00, 0xff, 0x2f, 0x00]);
});
test('a part file is the tempo map plus its tracks, at the score division', () => {
    const part = extractTracks(score, [2]);
    assert.equal(midiTrackCount(part), 2);
    assert.deepEqual([...part.subarray(8, 14)], [0, 1, 0, 2, 0x01, 0xe0]);
    assert.deepEqual([...part.subarray(part.length - track2.length)], track2);
    const first = extractTracks(score, [0, 1]);
    assert.equal(midiTrackCount(first), 2);
    assert.equal(midiNoteCount(score), 3);
    assert.equal(midiNoteCount(part), 1);
    assert.throws(() => extractTracks(score, [3]));
    assert.throws(() => extractTracks(score, []));
});
