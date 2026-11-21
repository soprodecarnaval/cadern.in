// Export MIDI for the full score and every part of local score files through
// the browser-score library in headless Chrome, check that each file parses,
// and compare it with desktop MuseScore MIDI when a reference is given: same
// tracks, note count, duration (±1 beat) and instrument programs.
//   npm run browser-score:assets
//   MIDI_INPUT=a.mscz,b.mscz node scripts/browserScore/midi.mjs
// Optional:
//   MIDI_REFERENCE=dir     desktop MIDI next to each input: <dir>/<stem>.midi (score)
//                          and <dir>/<stem>_<PART>.midi (parts, by part name)
//   MIDI_RESULTS=dir       (default test-results/browser-score-midi)
//   CHROME=/path/to/chrome (default /usr/bin/google-chrome)
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { resolve, extname, basename, dirname } from 'node:path';
import assert from 'node:assert/strict';

/** Tracks of a standard MIDI file: note-on count, programs, last tick; plus division. */
export function readMidi(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = (at, length) => String.fromCharCode(...bytes.subarray(at, at + length));
    assert.equal(text(0, 4), 'MThd', 'not a MIDI file');
    const trackCount = view.getUint16(10), division = view.getUint16(12);
    const tracks = [];
    let at = 8 + view.getUint32(4);
    while (at < bytes.length && tracks.length < trackCount) {
        assert.equal(text(at, 4), 'MTrk', 'bad track chunk');
        const end = at + 8 + view.getUint32(at + 4);
        let p = at + 8, tick = 0, status = 0;
        const track = { notes: 0, programs: new Set(), endTick: 0, channels: new Set() };
        const varint = () => { let value = 0, byte; do { byte = bytes[p++]; value = (value << 7) | (byte & 0x7f); } while (byte & 0x80); return value; };
        while (p < end) {
            tick += varint();
            let byte = bytes[p];
            if (byte & 0x80) { status = byte; p++; }
            if (status === 0xff) { p++; const length = varint(); p += length; }
            else if (status === 0xf0 || status === 0xf7) { const length = varint(); p += length; }
            else {
                const type = status & 0xf0, data1 = bytes[p++];
                const data2 = type === 0xc0 || type === 0xd0 ? 0 : bytes[p++];
                if (type === 0x90 && data2 > 0) { track.notes++; track.channels.add(status & 0x0f); }
                if (type === 0xc0) track.programs.add(data1);
            }
            track.endTick = tick;
        }
        tracks.push(track);
        at = end;
    }
    const playing = tracks.filter(track => track.notes);
    return { division, tracks: playing.map(track => ({ notes: track.notes, programs: [...track.programs].sort((a, b) => a - b) })),
        notes: playing.reduce((sum, track) => sum + track.notes, 0), beats: Math.max(0, ...tracks.map(track => track.endTick)) / division };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const inputs = (process.env.MIDI_INPUT || '').split(',').filter(Boolean).map(path => resolve(path));
    if (!inputs.length) throw Error('Set MIDI_INPUT (comma-separated .mscz/.mscx files).');
    const results = resolve(process.env.MIDI_RESULTS || 'test-results/browser-score-midi');
    await rm(results, { recursive: true, force: true });
    await mkdir(results, { recursive: true });
    const bundle = (await build({ entryPoints: [resolve('src/lib/browserScore/index.ts')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false })).outputFiles[0].contents;
    const assets = resolve('public/browser-score');
    const server = createServer(async (request, response) => {
        const name = new URL(request.url, 'http://localhost').pathname;
        if (name === '/') { response.setHeader('Content-Type', 'text/html'); return response.end('<!doctype html><title>MIDI</title>'); }
        if (name === '/browser.js') { response.setHeader('Content-Type', 'text/javascript'); return response.end(bundle); }
        const path = resolve('public' + name);
        if (!path.startsWith(assets + '/')) return response.writeHead(403).end();
        try {
            response.setHeader('Content-Type', extname(path) === '.wasm' ? 'application/wasm' : ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : 'application/octet-stream');
            response.end(await readFile(path));
        } catch { response.writeHead(404).end(); }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
    const report = { date: new Date().toISOString(), files: [] };
    const normalize = name => name.normalize('NFC').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    let failures = 0;
    try {
        for (const input of inputs) {
            const page = await browser.newPage();
            await page.goto(origin + '/');
            const exported = await page.evaluate(async ({ bytes, name }) => {
                const { createScoreLibrary } = await import('/browser.js');
                const library = await createScoreLibrary({ adapter: 'webmscore-1.2.1', execution: 'worker',
                    assets: { manifestUrl: new URL('/browser-score/manifest.json', location.href), workerUrl: new URL('/browser-score/worker.js', location.href) } });
                try {
                    const session = await library.open({ bytes: new Uint8Array(bytes), format: name.endsWith('.mscx') ? 'mscx' : 'mscz', name }, { compatibility: 'allowUnverified' });
                    const catalog = await session.prepareParts({ policy: 'preserveExistingOrGenerateIfNone', expectedRevision: 0 });
                    const views = [{ name: null, view: { kind: 'score' } }, ...catalog.parts.map(part => ({ name: part.name, view: { kind: 'part', partId: part.id } }))];
                    const out = [];
                    for (const { name, view } of views) {
                        const t = performance.now();
                        const midi = await session.exportMidi(view, { expectedRevision: catalog.revision });
                        out.push({ name, filename: midi.filename, bytes: [...midi.midi], ms: Math.round(performance.now() - t) });
                    }
                    return out;
                } finally { await library.dispose(); }
            }, { bytes: [...await readFile(input)], name: basename(input) });
            await page.close();
            const stem = basename(input).replace(/\.(mscz|mscx)$/i, '');
            const reference = process.env.MIDI_REFERENCE ? resolve(process.env.MIDI_REFERENCE) : dirname(input);
            const available = await readdir(reference).catch(() => []);
            const file = { file: basename(input), midis: [] };
            for (const item of exported) {
                const bytes = new Uint8Array(item.bytes);
                await writeFile(resolve(results, item.filename), bytes);
                const ours = readMidi(bytes);
                const wanted = item.name === null ? `${stem}.midi` : `${stem}_${normalize(item.name)}.midi`;
                const match = available.find(entry => entry.normalize('NFC') === wanted.normalize('NFC'));
                const entry = { part: item.name ?? '(score)', filename: item.filename, ms: item.ms, ours, reference: null, issues: [] };
                if (match) {
                    const desktop = readMidi(new Uint8Array(await readFile(resolve(reference, match))));
                    entry.reference = { file: match, ...desktop };
                    if (ours.tracks.length !== desktop.tracks.length) entry.issues.push(`tracks ${ours.tracks.length} vs ${desktop.tracks.length}`);
                    if (ours.notes !== desktop.notes) entry.issues.push(`notes ${ours.notes} vs ${desktop.notes}`);
                    if (Math.abs(ours.beats - desktop.beats) > 1) entry.issues.push(`beats ${ours.beats.toFixed(2)} vs ${desktop.beats.toFixed(2)}`);
                    const programs = tracks => JSON.stringify(tracks.map(track => track.programs));
                    if (programs(ours.tracks) !== programs(desktop.tracks)) entry.issues.push(`programs ${programs(ours.tracks)} vs ${programs(desktop.tracks)}`);
                }
                failures += entry.issues.length ? 1 : 0;
                console.log(`${stem} ${entry.part}: ${ours.tracks.length} tracks, ${ours.notes} notes, ${ours.beats.toFixed(1)} beats${entry.reference ? (entry.issues.length ? ` — differs: ${entry.issues.join('; ')}` : ' — matches desktop') : ' — no reference'}`);
                file.midis.push(entry);
            }
            report.files.push(file);
        }
    } finally {
        await browser.close();
        await new Promise(done => server.close(done));
        await writeFile(resolve(results, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    }
    console.log(`Report: ${resolve(results, 'report.json')}; ${failures} file(s) differ from desktop.`);
}
