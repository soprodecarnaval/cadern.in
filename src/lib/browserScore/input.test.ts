import { test } from 'vitest';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { inspect } from './input';
import { ScoreError } from './types';

const xml = strToU8('<museScore version="3.01"><Score><Staff id="1"/></Score></museScore>');
const container = strToU8('<container><rootfiles><rootfile full-path="score.mscx"/></rootfiles></container>');
const archive = (extra: Record<string, Uint8Array> = {}) => zipSync({ 'META-INF/container.xml': container, 'score.mscx': xml, ...extra });
const code = (expected: string) => (error: unknown) => error instanceof ScoreError && error.code === expected;

test('version inspection and compressed/uncompressed XML equivalence', () => {
    assert.equal(inspect(xml, 'mscx').fileVersion, '3.01');
    assert.deepEqual(inspect(archive(), 'mscz').xml, xml);
});
test('reject malformed, entities, wrong format and invalid UTF-8', () => {
    for (const text of ['bad', '<!DOCTYPE a><museScore/>', '<museScore/>', '<museScore version="x"><Score/></museScore>']) {
        assert.throws(() => inspect(strToU8(text), 'mscx'), code('INVALID_INPUT'));
    }
    assert.throws(() => inspect(new Uint8Array([255]), 'mscx'), code('INVALID_INPUT'));
    assert.throws(() => inspect(xml, 'pdf' as 'mscx'), code('UNSUPPORTED_FORMAT'));
    assert.throws(() => inspect(archive(), 'mscx'), code('INVALID_INPUT'));
    assert.throws(() => inspect(xml, 'mscz'), code('INVALID_INPUT'));
});
test('reject archive corruption, unsafe paths and missing or ambiguous score', () => {
    assert.throws(() => inspect(new Uint8Array(), 'mscx'), code('INVALID_INPUT'));
    assert.throws(() => inspect(zipSync({ 'score.mscx': xml }), 'mscz'), code('INVALID_INPUT'));
    assert.throws(() => inspect(archive({ '../escape': xml }), 'mscz'), code('INVALID_INPUT'));
    const broken = archive();
    broken[0] = 0;
    assert.throws(() => inspect(broken, 'mscz'), code('INVALID_INPUT'));
    const roots = strToU8('<container><rootfiles><rootfile full-path="score.mscx"/><rootfile full-path="other.mscx"/></rootfiles></container>');
    assert.throws(() => inspect(archive({ 'META-INF/container.xml': roots, 'other.mscx': xml }), 'mscz'), code('INVALID_INPUT'));
});
test('enforce input and archive limits before engine loading', () => {
    assert.throws(() => inspect(xml, 'mscx', { inputBytes: 8 }), code('RESOURCE_LIMIT'));
    assert.throws(() => inspect(archive(), 'mscz', { expandedBytes: 8 }), code('RESOURCE_LIMIT'));
    assert.throws(() => inspect(archive(), 'mscz', { archiveEntries: 1 }), code('RESOURCE_LIMIT'));
});
test('reject actual inflation beyond forged declared size', () => {
    const bytes = archive({ 'large': new Uint8Array(100000) });
    const view = new DataView(bytes.buffer);
    for (let offset = 0; offset + 46 < bytes.length; offset++) {
        if (view.getUint32(offset, true) === 0x02014b50) {
            const length = view.getUint16(offset + 28, true);
            if (new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + length)) === 'large') {
                view.setUint32(offset + 24, 1, true);
            }
        }
    }
    assert.throws(() => inspect(bytes, 'mscz'), code('RESOURCE_LIMIT'));
});
test('resource policy rejects external or missing image paths and retains embedded assets', () => {
    for (const path of ['https://example.com/image.png', '/tmp/image.png', '../image.png', 'Pictures/missing.png']) {
        const source = strToU8('<museScore version="3.01"><Score><Image><path>' + path + '</path></Image></Score></museScore>');
        assert.throws(() => inspect(source, 'mscx'), code('INVALID_INPUT'));
    }
    const source = strToU8('<museScore version="3.01"><Score><Image><path>Pictures/image.png</path></Image></Score></museScore>');
    const bytes = archive({ 'score.mscx': source, 'Pictures/image.png': new Uint8Array([1, 2]) });
    const result = inspect(bytes, 'mscz');
    assert.equal(result.warnings.length, 2);
    assert.deepEqual(inspect(result.bytes, 'mscz').xml, source);
});

test('accept native MSCZ master alongside declared linked-part score entries', () => {
    const roots = strToU8('<container><rootfiles><rootfile full-path="score.mscx"/><rootfile full-path="Excerpts/Piano/Piano.mscx"/></rootfiles></container>');
    assert.equal(inspect(archive({ 'META-INF/container.xml': roots, 'Excerpts/Piano/Piano.mscx': xml }), 'mscz').fileVersion, '3.01');
});
test('convert 4.1+ key signatures to the written key the 4.0 engine reads', () => {
    const modern = strToU8('<museScore version="4.50"><Score><Staff id="1"><Measure><voice>'
        + '<KeySig><concertKey>-1</concertKey></KeySig>'
        + '<KeySig><concertKey>-1</concertKey>\n  <actualKey>2</actualKey>\n</KeySig>'
        + '<KeySig><accidental>3</accidental></KeySig>'
        + '</voice></Measure></Staff></Score></museScore>');
    const result = inspect(modern, 'mscx');
    const text = new TextDecoder().decode(result.bytes);
    assert.match(text, /<KeySig><accidental>-1<\/accidental><\/KeySig>/);
    assert.match(text, /<KeySig><accidental>2<\/accidental>\n<\/KeySig>/);
    assert.match(text, /<KeySig><accidental>3<\/accidental><\/KeySig>/);
    assert.doesNotMatch(text, /concertKey|actualKey/);
    assert.ok(result.warnings.some(w => w.code === 'KEY_SIGNATURES_CONVERTED' && w.message.startsWith('2 ')));
    assert.ok(!inspect(xml, 'mscx').warnings.some(w => w.code === 'KEY_SIGNATURES_CONVERTED'));
});
test('read saved part names from 4.x excerpt meta tags', () => {
    const part = strToU8('<museScore version="4.50"><Score><metaTag name="partName">FLAUTA</metaTag><metaTag name="workTitle">x</metaTag></Score></museScore>');
    const nameless = strToU8('<museScore version="4.50"><Score><metaTag name="workTitle">x</metaTag></Score></museScore>');
    const result = inspect(archive({ 'Excerpts/0_Flute/0_Flute.mscx': part, 'Excerpts/1_Oboe/1_Oboe.mscx': nameless }), 'mscz');
    assert.deepEqual({ ...result.savedPartNames }, { '0_Flute': 'FLAUTA' });
});
