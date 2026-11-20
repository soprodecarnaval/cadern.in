// SPDX-License-Identifier: GPL-3.0-only
// Serve the browser-score example page on loopback. The library is bundled from
// src/lib/browserScore with esbuild and the engine assets come from
// public/browser-score/, so run `npm run browser-score:assets` first (the
// `browser-score:example` npm script does both). Score processing happens in
// the browser worker; this server only serves static files.
//   npm run browser-score:example        then open the printed URL
//   PORT=8081 npm run browser-score:example
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const root = resolve(new URL('../../', import.meta.url).pathname);
const folders = {
    '/example/': resolve(root, 'scripts/browserScore/example'),
    '/browser-score/': resolve(root, 'public/browser-score'),
};
const port = Number(process.env.PORT || 8080);
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
};
const bundle = async () => (await build({
    entryPoints: [resolve(root, 'src/lib/browserScore/index.ts')],
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false,
})).outputFiles[0].contents;

const server = createServer(async (request, response) => {
    try {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405).end();
            return;
        }
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (pathname === '/') {
            response.writeHead(302, { Location: '/example/index.html' }).end();
            return;
        }
        let bytes, type;
        if (pathname === '/browser.js') {
            // Rebuilt on every request so library edits show up on reload.
            bytes = await bundle();
            type = types['.js'];
        } else {
            const prefix = Object.keys(folders).find(p => pathname.startsWith(p));
            const file = prefix && resolve(folders[prefix], '.' + pathname.slice(prefix.length - 1));
            if (!file || !file.startsWith(folders[prefix] + '/')) {
                response.writeHead(404).end();
                return;
            }
            bytes = await readFile(file);
            type = types[extname(file)] || 'application/octet-stream';
        }
        response.setHeader('Content-Type', type);
        response.setHeader('Cache-Control', 'no-store');
        response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
        if (error?.code !== 'ENOENT') {console.error(error);}
        response.writeHead(404).end();
    }
});
server.on('error', error => {
    console.error(error.message);
    process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
    console.log('Open http://127.0.0.1:' + server.address().port + '/example/index.html');
});
