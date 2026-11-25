import { test } from 'vitest';
import assert from 'node:assert/strict';
import { excerptMasterParts, musicXmlTargets } from './excerptLinks';

const trumpet = { name: 'Trompete em B♭', instrumentName: 'Trompete em B♭', instrumentId: 'bb-trumpet' };
const flute = { name: 'Flauta', instrumentName: 'Flauta', instrumentId: 'flute' };
const scorePart = (partId: string) => ({ partId, trackName: '', instruments: [] });
const ids = ['P1', 'P2', 'P3'];

test('the file links decide: identical main-score parts go to their own excerpts', () => {
    // chuva_suor_cerveja: PETE_SEM_PIRATA and PETE_COM_PIRATA are identical trumpet parts.
    const metadata = { parts: [flute, trumpet, trumpet], excerpts: [{ title: 'COM', parts: [trumpet] }, { title: 'SEM', parts: [trumpet] }] };
    const info = { savedPartIds: {}, scoreParts: ['', '', ''].map(scorePart), inlineExcerpts: [{ title: 'COM', masterParts: [2] }, { title: 'SEM', masterParts: [1] }] };
    assert.deepEqual(musicXmlTargets(metadata, ids, info), [['P3'], ['P2']]);
});
test('links match an excerpt whose instrument was renamed', () => {
    // PEQUENA_EVA: the excerpt calls the instrument "Bb", the main score "Saxofone Tenor".
    const metadata = { parts: [flute, { ...trumpet, instrumentName: 'Saxofone Tenor' }], excerpts: [{ title: 'TENOR', parts: [{ ...trumpet, instrumentName: 'Bb' }] }] };
    const info = { savedPartIds: {}, scoreParts: ['', ''].map(scorePart), inlineExcerpts: [{ title: 'TENOR', masterParts: [1] }] };
    assert.deepEqual(musicXmlTargets(metadata, ['P1', 'P2'], info), [['P2']]);
    assert.deepEqual(musicXmlTargets(metadata, ['P1', 'P2'], { ...info, inlineExcerpts: [] }), [null]);
});
test('4.x saved parts link by part id', () => {
    const metadata = { parts: [flute, trumpet, trumpet], excerpts: [{ title: '1_Pete', parts: [trumpet] }] };
    const info = { savedPartIds: { '1_Pete': ['9'] }, scoreParts: [scorePart('1'), scorePart('4'), scorePart('9')] };
    assert.deepEqual(excerptMasterParts(metadata, 0, info), [2]);
    assert.deepEqual(musicXmlTargets(metadata, ids, info), [['P3']]);
});
test('links are ignored when titles or counts disagree with the engine', () => {
    const metadata = { parts: [flute, trumpet, trumpet], excerpts: [{ title: 'A', parts: [trumpet] }] };
    const info = { savedPartIds: {}, scoreParts: ['', '', ''].map(scorePart), inlineExcerpts: [{ title: 'B', masterParts: [2] }] };
    assert.equal(excerptMasterParts(metadata, 0, info), null);
    assert.equal(excerptMasterParts(metadata, 0, { ...info, inlineExcerpts: [] }), null);
});
test('without links, identical parts are given out in score order when every one is used', () => {
    const info = { savedPartIds: {}, scoreParts: ['', '', ''].map(scorePart) };
    const both = { parts: [flute, trumpet, trumpet], excerpts: [{ title: 'A', parts: [trumpet] }, { title: 'F', parts: [flute] }, { title: 'B', parts: [trumpet] }] };
    assert.deepEqual(musicXmlTargets(both, ids, info), [['P2'], ['P1'], ['P3']]);
    // bella ciao: a spare trumpet no excerpt uses leaves the trumpet ambiguous.
    const spare = { parts: [flute, trumpet, trumpet], excerpts: [{ title: 'A', parts: [trumpet] }, { title: 'F', parts: [flute] }] };
    assert.deepEqual(musicXmlTargets(spare, ids, info), [null, ['P1']]);
});
