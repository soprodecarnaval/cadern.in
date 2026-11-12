import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const qml = readFileSync(new URL('../caderninhoFormatter.qml', import.meta.url), 'utf8');
function functions(names, globals) {
  const context = { ...globals };
  for (const name of names) {
    const source = qml.match(new RegExp(`    function ${name}\\([^]*?\\n    }`));
    assert.ok(source, `Missing QML function ${name}`);
    runInNewContext(source[0], context);
  }
  return context;
}

test('real formatter traversal skips tied continuations/rests and keeps singleton offsets finite', () => {
  const chord = tieBack => ({ type: 1, notes: [{ pitch: 34, tieBack, elements: [] }], stem: {} });
  const events = [chord(null), chord({}), { type: 2 }, null];
  const fingerings = [];
  const score = { newCursor() {
    let index = 0;
    return { rewind() { index = 0; }, next() { index++; },
      get element() { return events[index]; },
      get segment() { return index < events.length ? { annotations: [] } : null; },
      add(el) { fingerings.push(el); } };
  } };
  const formatter = functions(['scoreExtremes', 'getNotePitchOffset', 'cleanFingering', 'griffStaff'], {
    Element: { CHORD: 1, FINGERING: 3, STAFF_TEXT: 4 },
    newElement: type => ({ type }), log: () => {},
    minOffset: -1, multiNoteOffset: -2.3, pitchOffsetScale: -5,
  });
  const pitches = [];
  formatter.griffStaff(score, 0, pitch => { pitches.push(pitch); return '0'; });
  assert.deepEqual(pitches, [34]);
  assert.deepEqual(fingerings, [{ type: 3, text: '0', offsetY: -1 }]);
  assert.equal(events[0].stem.stemDirection, 2);
  assert.equal(events[1].stem.stemDirection, 2);
});

test('all-parts traversal processes available excerpt scores', () => {
  const first = { name: 'Bb tuba' };
  const second = { name: 'Eb tuba' };
  const formatter = functions(['forAllParts'], {
    curScore: { excerpts: [{ partScore: first }, { partScore: null }, { partScore: second }] },
  });
  const visited = [];
  formatter.forAllParts(score => visited.push(score));
  assert.deepEqual(visited, [first, second]);
});
