// Copy the browser-score engine assets (webmscore, Verovio, worker, renderer and
// sheet fonts) into public/browser-score/ with a manifest of SHA-256 digests.
// The library fetches them at run time from `<origin>/browser-score/manifest.json`.
// Run with `npm run browser-score:assets`; the output is gitignored.
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const output = new URL('public/browser-score/', root);
const modules = new URL('node_modules/', root);
const engine = new URL('src/lib/browserScore/engine/', root);
await rm(output, { recursive: true, force: true });
const assets = [];
async function save(path, bytes) {
    await mkdir(new URL('./', new URL(path, output)), { recursive: true });
    await writeFile(new URL(path, output), bytes);
    assets.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const path of ['webmscore.mjs', 'webmscore.lib.wasm', 'webmscore.lib.mem.wasm', 'webmscore.lib.data']) {
    await save(path, await readFile(new URL('webmscore/' + path, modules)));
}
await save('src/index.js', Buffer.from("export { default } from '../webmscore.mjs';\n"));
await save('renderer.js', await readFile(new URL('renderer.js', engine)));
await save('worker.js', await readFile(new URL('worker.js', engine)));
for (const path of ['verovio-module.mjs', 'verovio.mjs']) {
    await save('verovio/' + path, await readFile(new URL('verovio/dist/' + path, modules)));
}
// Roboto for songbook sheet headers and fingerings.
for (const weight of [500, 700]) {
    const path = `roboto-latin-${weight}-normal.woff2`;
    await save('fonts/' + path, await readFile(new URL('@fontsource/roboto/files/' + path, modules)));
}
// Text fonts of the music pages, shared instead of embedded in every page (ticket 014): the four
// Liberation faces Verovio embeds with fontTextLiberation, taken from a Verovio render so they
// are exactly the fonts the pages are drawn with. Content-addressed names, listed with their
// family, weight and style for the reader and the songbook PDF.
const { default: createVerovioModule } = await import(new URL('verovio/dist/verovio-module.mjs', modules).href);
const { VerovioToolkit } = await import(new URL('verovio/dist/verovio.mjs', modules).href);
const toolkit = new VerovioToolkit(await createVerovioModule());
toolkit.setOptions({ fontTextLiberation: true, svgViewBox: true, header: 'none', footer: 'none' });
toolkit.loadData('<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list>'
    + '<part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><direction><direction-type><words>a</words></direction-type></direction><note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>');
const textFonts = [];
const ttfCopies = JSON.parse(await readFile(new URL('src/lib/browserScore/fonts/fonts.json', root), 'utf8'));
for (const face of toolkit.renderToSVG(1, false).matchAll(/@font-face\s*\{\s*font-family:\s*"([^"]+)";\s*src:\s*url\(data:[^;,]+(?:;charset=[^;,]+)?;base64,([^)]+)\)[^}]*?font-weight:\s*(\w+);\s*font-style:\s*(\w+);?\s*\}/g)) {
    const [, family, data, weight, style] = face;
    const bytes = Buffer.from(data, 'base64');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const path = `fonts/${family.toLowerCase()}-${weight}-${style}-${sha256.slice(0, 12)}.woff2`;
    await save(path, bytes);
    // The PDF needs TTF (PDFKit draws WOFF2 glyphs wrongly): the committed copy converted from this WOFF2.
    const ttfName = ttfCopies[sha256];
    if (!ttfName) throw new Error(`No TTF copy of Verovio's ${family} ${weight} ${style} font (${sha256.slice(0, 12)}). Run python3 scripts/browserScore/convertTextFonts.py`);
    const ttf = await readFile(new URL(`src/lib/browserScore/fonts/${ttfName}`, root));
    const ttfPath = `fonts/${ttfName.replace(/\.ttf$/, '')}-${createHash('sha256').update(ttf).digest('hex').slice(0, 12)}.ttf`;
    await save(ttfPath, ttf);
    textFonts.push({ family, weight, style, path, sha256, ttfPath });
}
if (textFonts.length !== 4) throw new Error(`Expected 4 Verovio text fonts, found ${textFonts.length}`);
await writeFile(new URL('manifest.json', output), JSON.stringify({
    engine: 'webmscore-1.2.1',
    protocolVersion: 1,
    renderer: 'verovio-6.4.0',
    textFonts,
    assets
}, null, 2) + '\n');
