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
await writeFile(new URL('manifest.json', output), JSON.stringify({
    engine: 'webmscore-1.2.1',
    protocolVersion: 1,
    renderer: 'verovio-6.4.0',
    assets
}, null, 2) + '\n');
