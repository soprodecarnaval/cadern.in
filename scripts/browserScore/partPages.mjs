// Render every part of local score files through the browser-score library in
// headless Chrome and check each part's pages against its full-score MusicXML:
// notes, rests, physical page size, self-contained resources and system-wide
// markings. Writes the pages and a review page for visual sign-off.
//   npm run browser-score:assets
//   PART_PAGES_INPUT=a.mscz,b.mscz npm run browser-score:parts
// Optional:
//   PART_PAGES_STYLE=songbook|fitted|plain   (default songbook)
//   PART_PAGES_FIT=171.7x98.2                fitted: music box in mm
//   PART_PAGES_SIZE=B6|score|WxH[:t,r,b,l]   plain: paper in mm
//   PART_PAGES_RESULTS=dir                   (default test-results/browser-score)
//   PART_PAGES_CLEANUP=1                     clean-up (src/lib/scoreRender/cleanup) before drawing
//   CHROME=/path/to/chrome                   (default /usr/bin/google-chrome)
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import assert from 'node:assert/strict';

const inputs = (process.env.PART_PAGES_INPUT || '').split(',').filter(Boolean).map(path => resolve(path));
if (!inputs.length) throw Error('Set PART_PAGES_INPUT (comma-separated .mscz/.mscx files).');
const style = process.env.PART_PAGES_STYLE || 'songbook';
const size = text => { const [w, h] = text.split('x').map(Number); return { widthMm: w, heightMm: h }; };
const fitArea = process.env.PART_PAGES_FIT ? size(process.env.PART_PAGES_FIT) : undefined;
const sizeText = process.env.PART_PAGES_SIZE;
const partPageSize = !sizeText || sizeText === 'B6' || sizeText === 'score' ? sizeText : (([dims, margins]) =>
    ({ ...size(dims), ...(margins ? { marginsMm: margins.split(',').map(Number) } : {}) }))(sizeText.split(':'));
const libraryOptions = { partPageStyle: style, ...(fitArea ? { fitArea } : {}), ...(partPageSize ? { partPageSize } : {}) };
const expectedSize = style === 'songbook' ? { widthMm: 176, heightMm: 125 } : style === 'fitted' ? fitArea : typeof partPageSize === 'object' ? partPageSize : null;
const cleanup = process.env.PART_PAGES_CLEANUP === '1';
const bundle = (await build({ stdin: { contents: "export * from './src/lib/browserScore/index.ts'; export { cleanupMusicXmlText } from './src/lib/scoreRender/cleanup.ts';", resolveDir: resolve('.'), loader: 'ts' }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false })).outputFiles[0].contents;
const assets = resolve('public/browser-score');
const results = resolve(process.env.PART_PAGES_RESULTS || 'test-results/browser-score');
await rm(results, { recursive: true, force: true });
await mkdir(results, { recursive: true });
const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    if (name === '/') { response.setHeader('Content-Type', 'text/html'); return response.end('<!doctype html><title>Part pages</title>'); }
    if (name === '/browser.js') { response.setHeader('Content-Type', 'text/javascript'); return response.end(bundle); }
    const path = resolve('public' + name);
    if (request.method !== 'GET' || !path.startsWith(assets + '/')) return response.writeHead(403).end();
    try {
        response.setHeader('Content-Type', extname(path) === '.wasm' ? 'application/wasm' : ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : 'application/octet-stream');
        response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
const origin = `http://127.0.0.1:${server.address().port}`;

const report = { date: new Date().toISOString(), files: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
try {
    const context = await browser.newContext();
    const external = [];
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : (external.push(route.request().url()), route.abort()));
    for (const input of inputs) {
        const page = await context.newPage();
        await page.goto(origin + '/');
        const bytes = [...await readFile(input)];
        const outcome = await page.evaluate(async ({ bytes, name, libraryOptions, cleanup }) => {
            const { createScoreLibrary, cleanupMusicXmlText } = await import('/browser.js');
            const cleaned = new Map();
            const partTransform = cleanup ? ({ musicXml, part }) => {
                const result = cleanupMusicXmlText(musicXml);
                cleaned.set(part.id, result.report);
                return { musicXml: result.musicXml };
            } : undefined;
            const library = await createScoreLibrary({ adapter: 'webmscore-1.2.1', execution: 'worker', ...libraryOptions,
                assets: { manifestUrl: new URL('/browser-score/manifest.json', location.href), workerUrl: new URL('/browser-score/worker.js', location.href) } });
            try {
                const session = await library.open({ bytes: new Uint8Array(bytes), format: name.endsWith('.mscx') ? 'mscx' : 'mscz', name }, { compatibility: 'allowUnverified', partTransform });
                const catalog = await session.prepareParts({ policy: 'preserveExistingOrGenerateIfNone', expectedRevision: 0 });
                const exported = await session.exportMusicXml({ expectedRevision: catalog.revision });
                const xml = new DOMParser().parseFromString(exported.musicXml, 'application/xml');
                const markingsOf = part => [...part.querySelectorAll('direction')].filter(d => d.querySelector('metronome, segno, coda, rehearsal') || [...(d.querySelector('sound')?.attributes ?? [])].some(a => ['tempo', 'dacapo', 'dalsegno', 'fine', 'tocoda', 'segno', 'coda'].includes(a.name))).length;
                const topMarkings = markingsOf(xml.querySelector('score-partwise > part'));
                const parts = [];
                for (const part of catalog.parts) {
                    const view = { kind: 'part', partId: part.id };
                    const t = performance.now();
                    const { pageCount } = await session.getPages(view);
                    const pages = [];
                    for (let n = 1; n <= pageCount; n++) pages.push(await session.renderPage(view, n, { expectedRevision: catalog.revision, background: 'white' }));
                    const docs = pages.map(p => new DOMParser().parseFromString(p.svg, 'image/svg+xml'));
                    const count = selector => docs.reduce((sum, d) => sum + d.querySelectorAll(selector).length, 0);
                    const id = exported.parts.find(p => p.catalogPart?.id === part.id)?.id;
                    const body = [...xml.querySelectorAll('score-partwise > part')].find(p => p.getAttribute('id') === id);
                    const notes = body ? [...body.querySelectorAll('note')] : [];
                    parts.push({ ordinal: part.ordinal, name: part.name, instrumentIds: part.instrumentIds, cleanup: cleaned.get(part.id) ?? null, musicXmlPart: id ?? null, ms: Math.round(performance.now() - t), pageCount,
                        pages: pages.map(p => ({ filename: p.filename, svg: p.svg, widthMm: p.widthMm, heightMm: p.heightMm })),
                        warnings: [...new Set(pages.flatMap(p => p.warnings.map(w => w.code)))],
                        rendered: { notes: count('g.note'), rests: count('g.rest, g.mRest, g.multiRest'), tempo: count('g.tempo'), rehearsal: count('g.reh'), repeatMarks: count('g.repeatMark'), dynamics: count('g.dynam'), fingerings: count('g.fing'), directions: count('g.dir') },
                        source: { measures: body?.querySelectorAll(':scope > measure').length ?? 0, notes: notes.filter(n => n.querySelector('pitch')).length, rests: notes.filter(n => n.querySelector('rest')).length },
                        externalUrls: pages.some(p => /url\((?!data:)/.test(p.svg) || /href="(?!#|data:)/.test(p.svg)) });
                }
                await session.dispose();
                return { partCount: catalog.parts.length, origin: catalog.parts[0]?.origin, topMarkings, parts };
            } finally { await library.dispose(); }
        }, { bytes, name: basename(input), libraryOptions, cleanup });
        await page.close();
        const label = basename(input).replace(/\.(mscz|mscx)$/i, '');
        for (const part of outcome.parts) {
            for (const p of part.pages) { await writeFile(resolve(results, p.filename), p.svg); delete p.svg; }
            const tag = `${label} part ${part.ordinal} ${part.name}`;
            assert(part.pageCount > 0, `${tag}: no pages`);
            assert(part.instrumentIds.length > 0, `${tag}: no instrument ids`);
            assert.equal(part.rendered.notes, part.source.notes, `${tag}: notes`);
            assert.equal(part.rendered.rests, part.source.rests, `${tag}: rests`);
            assert(!part.externalUrls, `${tag}: external resource`);
            if (expectedSize) assert(part.pages.every(p => Math.abs(p.widthMm - expectedSize.widthMm) < 0.01 && Math.abs(p.heightMm - expectedSize.heightMm) < 0.01), `${tag}: page size`);
            if (outcome.topMarkings) assert(part.rendered.tempo + part.rendered.rehearsal + part.rendered.repeatMarks > 0 || part.warnings.includes('SYSTEM_MARKINGS_COPIED') || part.ordinal === 1, `${tag}: system markings missing`);
            const removed = part.cleanup ? ` (removed ${part.cleanup.parts.reduce((n, p) => n + p.fingerings, 0)} fingerings, ${part.cleanup.parts.reduce((n, p) => n + p.staffText.length, 0)} staff texts)` : '';
            console.log(`${tag} [${part.instrumentIds.join(', ')}]${removed}: ${part.pageCount} page(s) ${part.pages[0].widthMm} × ${part.pages[0].heightMm} mm, ${part.rendered.notes} notes, ${part.rendered.rests} rests, ${part.ms} ms`);
        }
        report.files.push({ file: basename(input), ...outcome });
    }
    assert.deepEqual(external, [], 'no outside requests');
} finally {
    await browser.close();
    await new Promise(done => server.close(done));
    await writeFile(resolve(results, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
const escape = value => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
await writeFile(resolve(results, 'review.html'), `<!doctype html><meta charset="utf-8"><title>Part pages review</title>
<style>body{font:14px system-ui;margin:16px}.pages{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0;flex:1;min-width:320px;max-width:640px}
img{width:100%;border:1px solid #ccc;background:#fff}</style><h1>Part pages review</h1>` + report.files.map(file => `<h2>${escape(file.file)}</h2>` + file.parts.map(part =>
    `<h3>${part.ordinal}. ${escape(part.name)}</h3><p>${part.pageCount} page(s); ${part.rendered.notes} notes and ${part.rendered.rests} rests (MusicXML: ${part.source.notes} and ${part.source.rests}); ${escape(part.warnings.join(', '))}</p><div class="pages">`
    + part.pages.map(p => `<figure><img src="${escape(p.filename)}" alt="${escape(part.name)} page"><figcaption>${escape(p.filename)} · ${p.widthMm} × ${p.heightMm} mm</figcaption></figure>`).join('') + '</div>').join('')).join(''));
console.log('Review:', resolve(results, 'review.html'));
