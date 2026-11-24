// Run the browser upload pipeline (src/lib/scoreRender/renderForUpload) on
// local scores in headless Chrome, with every part chosen at its mapped
// instrument, and check that:
// - validateParsedScore accepts the result;
// - parseUploadedFiles, given the produced files as an exporter folder,
//   yields the same parts and Storage keys (key for key);
// - a second render gives the same bytes for every file.
//   npm run browser-score:assets
//   UPLOAD_INPUT=a.mscz,b.mscz node scripts/browserScore/upload.mjs
// Optional: UPLOAD_PROFILE=profile.json, UPLOAD_RESULTS=dir (default
// test-results/browser-score-upload), CHROME=/path/to/chrome.
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, extname, basename, dirname } from 'node:path';

const inputs = (process.env.UPLOAD_INPUT || '').split(',').filter(Boolean).map(path => resolve(path));
if (!inputs.length) throw Error('Set UPLOAD_INPUT (comma-separated .mscz files).');
const profile = process.env.UPLOAD_PROFILE ? JSON.parse(await readFile(process.env.UPLOAD_PROFILE, 'utf8')) : { profileVersion: 1 };
const results = resolve(process.env.UPLOAD_RESULTS || 'test-results/browser-score-upload');
await rm(results, { recursive: true, force: true });
await mkdir(results, { recursive: true });
const bundle = (await build({
    stdin: { contents: `
        export { renderForUpload } from './src/lib/scoreRender/renderForUpload.ts';
        export { createScoreLibrary } from './src/lib/browserScore/index.ts';
        export { validateParsedScore, parseUploadedFiles } from './src/lib/parseUploadedFiles.ts';
        export { mapInstrumentId, guessInstrument } from './src/lib/instruments/index.ts';
        export { libraryOptionsFor } from './src/lib/scoreRender/profile.ts';`, resolveDir: resolve('.'), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false })).outputFiles[0].contents;
const assets = resolve('public/browser-score');
const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    if (name === '/') { response.setHeader('Content-Type', 'text/html'); return response.end('<!doctype html><title>Upload</title>'); }
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
let failures = 0;
try {
    for (const input of inputs) {
        const page = await browser.newPage();
        await page.goto(origin + '/');
        const outcome = await page.evaluate(async ({ bytes, name, profile }) => {
            const m = await import('/browser.js');
            const data = new Uint8Array(bytes);
            const library = await m.createScoreLibrary({ adapter: 'webmscore-1.2.1', execution: 'worker', ...m.libraryOptionsFor(profile),
                assets: { manifestUrl: new URL('/browser-score/manifest.json', location.href), workerUrl: new URL('/browser-score/worker.js', location.href) } });
            try {
                // Every part, at its mapped instrument (or the name guess), as the send screen would offer.
                const session = await library.open({ bytes: data, format: 'mscz', name }, { compatibility: 'allowUnverified' });
                const catalog = await session.prepareParts({ policy: 'preserveExistingOrGenerateIfNone', expectedRevision: 0 });
                const choices = catalog.parts.map(part => {
                    const instrument = part.instruments[0];
                    const names = [part.name, instrument?.longName, instrument?.shortName];
                    const mapped = (instrument && (m.mapInstrumentId(instrument.id, names) ?? m.mapInstrumentId(instrument.soundId ?? '', names))) ?? m.guessInstrument(names);
                    return mapped ? { ordinal: part.ordinal, instrument: mapped } : null;
                }).filter(Boolean);
                await session.dispose();
                const render = () => m.renderForUpload(data, name, profile, choices, { library });
                const first = await render();
                const second = await render();
                const digest = async file => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
                const differing = [];
                for (const [key, file] of first.parsed.fileMap) {
                    const other = second.parsed.fileMap.get(key);
                    if (!other || await digest(file) !== await digest(other)) differing.push(key);
                }
                const validation = m.validateParsedScore(first.parsed);
                const exporterFiles = [...first.parsed.fileMap].filter(([key]) => !key.startsWith('arrangement/') && !key.startsWith('playback/'));
                const reparsed = await m.parseUploadedFiles(exporterFiles.map(([, file]) => file));
                const shape = parsed => JSON.stringify({ title: parsed.title, composer: parsed.composer, sub: parsed.sub, tags: parsed.tags, source: parsed.source ?? null,
                    parts: parsed.parts.map(({ playback, ...part }) => part), keys: [...parsed.fileMap.keys()].filter(key => !key.startsWith('arrangement/') && !key.startsWith('playback/')).sort() });
                const files = await Promise.all([...first.parsed.fileMap].map(async ([key, file]) => ({ key, name: file.name, bytes: [...new Uint8Array(await file.arrayBuffer())] })));
                return { parts: first.parsed.parts.length, skipped: catalog.parts.length - choices.length, validation, differing,
                    sameAsExporterFolder: shape(first.parsed) === shape(reparsed), ours: shape(first.parsed), exporter: shape(reparsed),
                    report: first.report.parts.map(p => ({ name: p.name, instrument: p.instrument, pages: p.pages, layout: p.layout, warnings: p.warnings.map(w => w.code) })), files };
            } finally { await library.dispose(); }
        }, { bytes: [...await readFile(input)], name: basename(input), profile });
        await page.close();
        const stem = basename(input).replace(/\.mscz$/i, '');
        for (const file of outcome.files) {
            const path = resolve(results, stem, file.key.includes('/') ? file.key : file.name);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, new Uint8Array(file.bytes));
        }
        delete outcome.files;
        await writeFile(resolve(results, stem, 'report.json'), JSON.stringify(outcome, null, 2) + '\n');
        const ok = !outcome.validation.length && !outcome.differing.length && outcome.sameAsExporterFolder;
        failures += ok ? 0 : 1;
        console.log(`${stem}: ${outcome.parts} parts (${outcome.skipped} without an instrument), ${ok ? 'valid, same as an exporter folder, deterministic' : `FAILED ${JSON.stringify({ validation: outcome.validation, differing: outcome.differing, sameAsExporterFolder: outcome.sameAsExporterFolder })}`}`);
        if (!outcome.sameAsExporterFolder) console.log(' ours    ', outcome.ours, '\n exporter', outcome.exporter);
    }
} finally {
    await browser.close();
    await new Promise(done => server.close(done));
}
if (failures) { console.error(`${failures} score(s) failed.`); process.exit(1); }
