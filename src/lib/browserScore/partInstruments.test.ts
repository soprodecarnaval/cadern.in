import { test } from 'vitest';
import assert from 'node:assert/strict';
import { excerptInstruments, instrumentIdsOf } from './partInstruments';

const tuba = { id: 'bb-tuba', soundId: 'brass.tuba', longName: 'Tuba B♭', shortName: 'Tba.' };
const trumpet = { id: 'bb-trumpet', soundId: 'brass.trumpet.bflat', longName: 'Trompete', shortName: 'Tpt.' };
const info = {
    savedPartIds: { Metais: ['2', '1'] },
    scoreParts: [{ partId: '1', trackName: 'Trumpet in B♭', instruments: [trumpet] }, { partId: '2', trackName: 'B♭ Tuba', instruments: [tuba] }]
};

test('saved parts take the instruments of their own score parts', () => {
    assert.deepEqual(excerptInstruments({ title: 'Metais', parts: [] }, 0, 1, info), [tuba, trumpet]);
});
test('other parts match by track name, then long name, then position', () => {
    assert.deepEqual(excerptInstruments({ title: 'x', parts: [{ name: 'B♭ Tuba', instrumentName: '' }] }, 0, 5, info), [tuba]);
    assert.deepEqual(excerptInstruments({ title: 'x', parts: [{ name: 'Other', instrumentName: 'Trompete' }] }, 1, 5, info), [trumpet]);
    assert.deepEqual(excerptInstruments({ title: 'x', parts: [{ name: 'Other', instrumentName: 'Other' }] }, 1, 2, info), [tuba]);
});
test('an unmatched part keeps only the engine sound id', () => {
    const instruments = excerptInstruments({ title: 'x', parts: [{ name: 'Órgão', instrumentName: 'Órgão', instrumentId: 'keyboard.organ' }] }, 0, 5, info);
    assert.deepEqual(instrumentIdsOf(instruments), ['keyboard.organ']);
    assert.deepEqual(excerptInstruments({ title: 'x', parts: [{ name: 'Órgão', instrumentName: 'Órgão' }] }, 0, 5, info), []);
});
