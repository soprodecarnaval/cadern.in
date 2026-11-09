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
