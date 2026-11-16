import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function loadLibrary(name, imports = {}) {
  const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
    .replace(/^\.(pragma|import).*$/gm, '');
  const context = { ...imports };
  runInNewContext(source, context, { filename: name });
  return context;
}

const Fingerings = loadLibrary('fingerings.js');
const instruments = loadLibrary('musescoreInstruments.js', { Fingerings });

test('sousaphone aliases match Bb tuba across MIDI range and fingering options', () => {
  for (const oneChar of [false, true]) {
    for (const breakLine of [false, true]) {
      const tuba = instruments.getGriffFn('bb-tuba', null, oneChar, breakLine);
      for (const id of ['sousaphone', 'bb-sousaphone']) {
        const sousaphone = instruments.getGriffFn(id, null, oneChar, breakLine);
        for (let pitch = 0; pitch <= 127; pitch++) {
          assert.equal(sousaphone(pitch), tuba(pitch), `${id}: ${pitch}`);
        }
      }
    }
  }
});

test('valve combinations and optional one-char fingerings remain distinct', () => {
  for (const [id, pitch] of [['bb-tuba', 28], ['sousaphone', 28],
    ['bb-sousaphone', 28], ['euphonium', 40]]) {
    assert.equal(instruments.getGriffFn(id, null, false, false)(pitch), '123');
    assert.equal(instruments.getGriffFn(id, null, false, true)(pitch), '1\n2\n3');
    assert.equal(instruments.getGriffFn(id, null, true, false)(pitch), '7');
  }
});

test('dynamic trombone state stays independent per staff', () => {
  const first = instruments.getGriffFn('trombone', null, false, false, true);
  const second = instruments.getGriffFn('trombone', null, false, false, true);
  assert.equal(first(41), '6');
  assert.equal(first(53), '6');
  assert.equal(second(53), '1');
  assert.equal(instruments.getGriffFn('trombone', null, false, false, false)(53), '1');
});

test('unsupported instruments produce no fingering function', () => {
  assert.equal(instruments.getGriffFn('unknown', null, false, false), null);
});

test('explicit IDs select modes and tuning even when part labels disagree', () => {
  const cases = [
    ['bb-tuba', 'Bb', 'concert-octave'],
    ['bb-tuba-treble', 'Bb', 'transposed-treble'],
    ['sousaphone', 'Bb', 'concert-octave'],
    ['bb-sousaphone-treble', 'Bb', 'transposed-treble'],
    ['bass-eb-tuba', 'Eb', 'concert-octave'],
    ['eb-tuba', 'Eb', 'concert-octave'],
    ['eb-tuba-treble', 'Eb', 'transposed-treble'],
  ];
  for (const [id, tuning, mode] of cases) {
    const policy = instruments.getTubaPolicy(id, { longName: tuning === 'Bb' ? 'E♭ Tuba' : 'Bb Tuba' });
    assert.equal(policy.tuning, tuning);
    assert.equal(policy.mode, mode);
  }
  assert.equal(instruments.getTubaPolicy('bb-sousaphone').mode, 'transposed-bass');
  assert.equal(instruments.getTubaPolicy('tuba').mode, 'concert-octave');
  assert.equal(instruments.getTubaPolicy('tuba').tuning, 'Bb');
  assert.equal(instruments.getTubaPolicy('tuba', { shortName: 'E♭' }).tuning, 'Eb');
  assert.equal(instruments.getTubaPolicy('brass.tuba', { partName: 'Eb' }).tuning, 'Eb');
  for (const id of ['c-tuba', 'bass-f-tuba', 'unknown', 'toString']) {
    assert.equal(instruments.getTubaPolicy(id), null);
  }
});

test('Bb open harmonics and valve reference notes are independent of notation mode', () => {
  for (const id of ['tuba', 'bb-tuba', 'bb-tuba-treble', 'sousaphone', 'bb-sousaphone-treble']) {
    const valves = instruments.getGriffFn(id, null, false, false);
    const oneChar = instruments.getGriffFn(id, null, true, false);
    for (const pitch of [34, 41, 46, 50, 53, 58]) {
      assert.equal(valves(pitch), '0', `${id}: ${pitch}`);
      assert.equal(oneChar(pitch), '1', `${id}: ${pitch}`);
    }
    assert.equal(valves(36), '13');
    assert.equal(valves(38), '12');
  }
});

test('Eb concert and treble IDs use Eb sounding-pitch fingerings', () => {
  for (const id of ['bass-eb-tuba', 'eb-tuba', 'eb-tuba-treble']) {
    const valves = instruments.getGriffFn(id, null, false, false);
    const oneChar = instruments.getGriffFn(id, null, true, false);
    for (const pitch of [39, 46, 51, 55, 58, 63]) {
      assert.equal(valves(pitch), '0', `${id}: ${pitch}`);
      assert.equal(oneChar(pitch), '1', `${id}: ${pitch}`);
    }
    assert.equal(valves(41), '13');
    assert.equal(valves(43), '12');
    assert.equal(valves(34), '13'); // Sounding Bb1, open on Bb tuba, is 1+3 on Eb.
    assert.equal(valves(20), '');
    assert.equal(valves(90), '');
  }
});
