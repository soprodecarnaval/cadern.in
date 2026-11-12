import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function library(name, imports = {}) {
  const context = { ...imports };
  runInNewContext(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
    .replace(/^\.(pragma|import).*$/gm, ''), context);
  return context;
}

const Fingerings = library('fingerings.js');
const instruments = library('musescoreInstruments.js', { Fingerings });
const notation = library('tubaNotation.js', { MsInstruments: instruments });
const Element = { CLEF: 1, CHORD: 2 };
const ClefType = { F: 10, G: 20, F8_VB: 30 };
const api = { Element, ClefType, fraction: (n, d) => ({ n, d }),
  newElement: type => ({ type }), log: () => {} };

function makeScore(ids, { midClefs = true, missingHeader = false } = {}) {
  const parts = ids.map((instrumentId, i) => ({ instrumentId, startTrack: i * 4,
    endTrack: (i + 1) * 4, instruments: [{}] }));
  const notes = ids.map(() => ({ type: Element.CHORD, notes: [{ pitch: 34, tpc1: 12 }] }));
  const makeClefs = () => ids.map(() => ({ type: Element.CLEF,
    concertClefType: ClefType.G, transposingClefType: ClefType.G }));
  const headers = missingHeader ? ids.map(() => null) : makeClefs();
  const middle = makeClefs();
  const rows = [headers, notes, ...(midClefs ? [middle] : [])];
  const segments = rows.map((row, i) => ({ tick: i * 480, elementAt: track => row[track / 4] }));
  segments.forEach((seg, i) => { seg.next = segments[i + 1] || null; });
  let additions = 0;
  const score = { parts, staves: ids.map(id => ({ transpose: () => ({
    chromatic: instruments.getTubaPolicy(id)?.nativeTranspose ?? 0 }) })),
  firstSegment: () => segments[0],
  newCursor: () => ({ segment: segments[1], rewind() {}, add(clef) {
    headers[this.staffIdx] = clef;
    additions++;
  } }) };
  return { score, headers, middle, notes, additions: () => additions };
}

test('format ID-selected clefs, leave deferred/other instruments and pitches alone', () => {
  const state = makeScore(['bb-tuba', 'bass-eb-tuba', 'tuba', 'bb-tuba-treble',
    'eb-tuba-treble', 'sousaphone', 'bb-sousaphone-treble', 'bb-sousaphone', 'trumpet']);
  const before = JSON.stringify(state.notes);
  notation.apply(state.score, api);
  for (const row of [state.headers, state.middle]) {
    for (const i of [0, 1, 2, 5]) {
      assert.equal(row[i].concertClefType, ClefType.F8_VB);
      assert.equal(row[i].transposingClefType, ClefType.F8_VB);
    }
    for (const i of [3, 4, 6]) {
      assert.equal(row[i].concertClefType, ClefType.F);
      assert.equal(row[i].transposingClefType, ClefType.G);
    }
    for (const i of [7, 8]) {
      assert.equal(row[i].concertClefType, ClefType.G);
    }
  }
  assert.equal(JSON.stringify(state.notes), before);
  const once = JSON.stringify([state.headers, state.middle]);
  notation.apply(state.score, api);
  assert.equal(JSON.stringify([state.headers, state.middle]), once);
  assert.equal(state.additions(), 0);
});

test('create a missing initial clef only once, even when mid-score clefs exist', () => {
  const state = makeScore(['eb-tuba'], { missingHeader: true });
  notation.apply(state.score, api);
  notation.apply(state.score, api);
  assert.equal(state.additions(), 1);
  assert.equal(state.headers[0].concertClefType, ClefType.F8_VB);
});

test('normalize customized transposition using the same ID and preserve display names', () => {
  const { score, headers } = makeScore(['eb-tuba-treble']);
  score.parts[0].longName = 'My Eb Tuba';
  score.parts[0].shortName = 'My Tba.';
  score.staves[0].transpose = () => ({ chromatic: -12 });
  const calls = [];
  score.replaceInstrument = (part, id) => calls.push(['replace', id]);
  score.setInstrumentName = (part, tick, name) => calls.push(['name', name]);
  score.setInstrumentAbbreviature = (part, tick, name) => calls.push(['shortName', name]);
  notation.apply(score, api);
  assert.deepEqual(calls, [['replace', 'eb-tuba-treble'], ['name', 'My Eb Tuba'], ['shortName', 'My Tba.']]);
  assert.equal(headers[0].transposingClefType, ClefType.G);
});

test('do not rewrite a part with instrument changes or an unsupported customized transposition', () => {
  const state = makeScore(['bb-tuba', 'eb-tuba']);
  state.score.parts[0].instruments = [{}, {}];
  state.score.staves[1].transpose = () => ({ chromatic: -12 });
  const before = JSON.stringify(state.headers);
  notation.apply(state.score, api);
  assert.equal(JSON.stringify(state.headers), before);
});
