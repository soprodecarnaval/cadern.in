// End-to-end test of the browser upload (ticket 018), against the Firebase
// emulators (demo-cadernin). Run with `npm run test:e2e`, which starts the
// emulators; it seeds them, starts a dev server with the browser upload as
// the default, and drives it in headless Chromium:
//   1. sign in as an editor, send test-scores/all-instruments.mscz, change a
//      formatting control, upload; check the revision, the Storage files and
//      the reader;
//   2. a stale songbook link is refused and writes nothing;
//   3. reformat that revision, then build a songbook PDF from its pages.
// Env: CHROME (a Chrome/Chromium binary; default: Playwright's Chromium),
// E2E_PORT (default 5199). Fails when an engine asset is missing (the engine
// cannot load) or when the staleness gate lets a stale link through.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const PROJECT = 'demo-cadernin';
const PORT = Number(process.env.E2E_PORT ?? 5199);
const BASE = `http://127.0.0.1:${PORT}`;
const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}/v1/projects/${PROJECT}/databases/(default)/documents/`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;
const ADMIN = { Authorization: 'Bearer owner' };
const sizedParts = [[/^Trompete/, "1.25"], [/^Tuba/, "0.65"]];
const SCORE = resolve('test-scores/all-instruments.mscz');

const run = (command, args, env = {}) => new Promise((done, fail) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('exit', code => (code === 0 ? done() : fail(new Error(`${command} ${args.join(' ')} exited with ${code}`))));
});
const json = async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
    return response.json();
};
const doc = path => json(FIRESTORE + path, { headers: ADMIN }).then(d => d.fields ?? {});
const docs = path => json(FIRESTORE + path, { headers: ADMIN }).then(d => d.documents ?? []);
const str = field => field?.stringValue;

// Seed, and mark the seeded accounts' e-mail as verified (the app asks for it).
await run('npx', ['tsx', 'scripts/dev/seedEmulators.ts']);
const { users = [] } = await json(`${AUTH}/accounts:batchGet?maxResults=100`, { headers: ADMIN });
for (const user of users) {
    await json(`${AUTH}/accounts:update`, { method: 'POST', headers: { ...ADMIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: user.localId, emailVerified: true }) });
}

const server = spawn(resolve('node_modules/.bin/vite'), ['--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, VITE_USE_EMULATORS: 'true', VITE_FEATURE_FLAG_COLLAB_FLOW: 'true', VITE_FEATURE_FLAG_BROWSER_UPLOAD: 'default' },
});
let serverExit = null;
server.on('exit', code => { serverExit = code; });
for (let i = 0; i < 60 && serverExit === null; i++) {
    if (await fetch(BASE).then(r => r.ok, () => false)) break;
    await new Promise(done => setTimeout(done, 1000));
}
if (serverExit !== null) throw new Error(`The dev server exited (${serverExit}); is port ${PORT} free?`);

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const failures = [];
const step = async (name, body) => {
    try { await body(); console.log(`ok - ${name}`); } catch (error) { failures.push(name); console.log(`not ok - ${name}\n  ${String(error.stack ?? error).split('\n').slice(0, 4).join('\n  ')}`); }
};

async function signedInPage(path) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', error => console.log('  page error:', error.message));
    await page.goto(BASE + path);
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    await page.locator('input[type=email]:visible').first().fill('editor@dev.cadern.in');
    await page.locator('input[type=password]:visible').first().fill('senha123');
    await page.locator('input[type=password]:visible').first().press('Enter');
    await page.getByText('Entre na sua conta para enviar').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
    await page.locator('.modal').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
    return page;
}

async function sendThroughScreen(page, { file, tweak = false } = {}) {
    if (file) await page.locator('input[type=file]').setInputFiles(file);
    await page.getByRole('heading', { name: 'Partes', exact: true }).waitFor({ timeout: 180000 });
    await page.getByRole('button', { name: /^Formatar/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('.enviar-preview img').length > 0 && !document.querySelector('.enviar-preview[aria-busy=true]'), null, { timeout: 300000 });
    if (tweak) {
        const sizeControls = page.getByRole('group', { name: 'Tamanho dos números' });
        const sizeInput = sizeControls.getByRole('spinbutton');
        const preview = page.locator('.enviar-preview img');
        const selectPart = async (name) => {
            await page.getByRole('tab', { name }).first().click();
            await preview.waitFor();
            await page.locator('.enviar-preview[aria-busy=false]').waitFor();
            return page.locator('.enviar-sheet-instrument').innerText();
        };
        const original = new Map();
        for (const [name] of sizedParts) {
            original.set(await selectPart(name), await preview.getAttribute('src'));
        }
        for (const [part, size] of sizedParts) {
            const name = await selectPart(part);
            assert.equal(await preview.getAttribute('src'), original.get(name), 'other parts keep their preview');
            assert(await sizeControls.getByRole('radio', { name: 'Automático' }).isChecked());
            await sizeControls.getByRole('radio', { name: 'Fixo' }).check();
            await sizeInput.fill(size);
            await page.waitForFunction(({ previous }) => {
                const img = document.querySelector('.enviar-preview[aria-busy=false] img');
                return img && img.getAttribute('src') !== previous;
            }, { previous: original.get(name) });
        }
        for (const [name, size] of sizedParts) {
            await selectPart(name);
            assert.equal(await sizeInput.inputValue(), size);
        }
    }
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForFunction(() => document.querySelector('.enviar-summary') || document.querySelector('[role=alert]'), null, { timeout: 60000 });
}

let revisionId = null;
let sentScoreId = null;
try {
    await step('sends all-instruments.mscz from the browser', async () => {
        const page = await signedInPage('/acervo-dev/enviar');
        await sendThroughScreen(page, { file: SCORE, tweak: true });
        assert.equal(await page.locator('[role=alert]').count(), 0, 'no error');
        assert.match(await page.locator('.enviar-summary').innerText(), /Partitura nova/);
        await page.getByRole('button', { name: 'Enviar partitura' }).click();
        await page.locator('#enviar-feito').waitFor({ timeout: 300000 });
        const href = await page.getByRole('link', { name: 'Ver a partitura' }).getAttribute('href');
        const [, scoreId, revision] = /\/partituras\/([^/]+)\/versoes\/([^/?]+)/.exec(href);
        assert.match(scoreId, /^acervo-dev-/);
        sentScoreId = scoreId;
        revisionId = revision;
        // Firestore: the revision and its parts, the score pointing at it.
        const score = await doc(`scores/${scoreId}`);
        assert.equal(str(score.latestRevisionId), revision);
        const data = await doc(`scores/${scoreId}/scoreRevisions/${revision}`);
        const parts = data.parts.arrayValue.values.map(v => v.mapValue.fields);
        assert.equal(parts.length, 19);
        assert(parts.some(p => str(p.instrument) === 'trompete pirata'), 'fingered trumpets are piratas');
        // Storage: every file the revision lists exists, under the exporter's keys.
        const files = [data.mscz, data.metajson, data.midi, ...parts.flatMap(p => [p.midi, ...p.svg.arrayValue.values])].map(v => v.mapValue.fields);
        for (const file of files) {
            assert.match(str(file.path), new RegExp(`^projects/acervo-dev/scores/${scoreId}/${revision}/(score\\.(mscz|metajson|midi)|parts/.+-\\d+\\.svg|parts/.+\\.midi)$`));
            const response = await fetch(str(file.url));
            assert(response.ok, `${str(file.path)} is readable`);
        }
        const metajson = await (await fetch(str(data.metajson.mapValue.fields.url))).json();
        assert.equal(metajson.version, 2);
        assert.equal(metajson.formatting?.fingering?.size, undefined);
        for (const [pattern, size] of sizedParts) {
            const name = parts.map(part => str(part.name)).find(name => pattern.test(name));
            assert(name, `saved part for ${pattern}`);
            assert.equal(metajson.formatting.parts[name].fingering.size, Number(size));
        }
        assert.match(metajson.renderer?.manifestSha256 ?? '', /^[0-9a-f]{64}$/);
        const svg = await (await fetch(str(parts[0].svg.arrayValue.values[0].mapValue.fields.url))).text();
        assert(!svg.includes('@font-face {\n    font-family: "Liberation"'), 'stored pages do not embed the shared fonts');
        // Reader: the score page shows the parts, with the shared fonts embedded again.
        await page.goto(BASE + href);
        await page.waitForFunction(() => [...document.images].some(img => img.src.startsWith('blob:') && img.naturalWidth > 0), null, { timeout: 60000 });
        await page.close();
    });

    await step('refuses a stale songbook link and writes nothing', async () => {
        const songbook = await doc('songbooks/acervo-dev~carnaval-dev');
        const before = str(songbook.currentRevisionId);
        const scoresBefore = (await docs('scores/acervo-dev-mamae-eu-quero/scoreRevisions')).length;
        const page = await signedInPage(`/acervo-dev/enviar?partitura=acervo-dev-mamae-eu-quero&caderninho=acervo-dev~carnaval-dev&versaoCaderninho=stale-${before}`);
        await sendThroughScreen(page, { file: SCORE });
        assert.match(await page.locator('[role=alert]').innerText(), /O caderninho mudou/);
        assert.equal(await page.getByRole('button', { name: 'Enviar partitura' }).isEnabled(), false, 'cannot send');
        assert.equal(str((await doc('songbooks/acervo-dev~carnaval-dev')).currentRevisionId), before);
        assert.equal((await docs('scores/acervo-dev-mamae-eu-quero/scoreRevisions')).length, scoresBefore);
        await page.close();
    });

    await step('reformats the revision and builds a songbook PDF from it', async () => {
        assert(revisionId, 'needs the first case');
        const scoreId = sentScoreId;
        const page = await signedInPage(`/acervo-dev/enviar?partitura=${scoreId}&versao=${revisionId}&base=${revisionId}&modo=reformatar`);
        await sendThroughScreen(page);
        assert.match(await page.locator('.enviar-summary').innerText(), /Nova versão/);
        await page.getByRole('button', { name: 'Enviar partitura' }).click();
        await page.locator('#enviar-feito').waitFor({ timeout: 300000 });
        const latest = str((await doc(`scores/${scoreId}`)).latestRevisionId);
        const data = await doc(`scores/${scoreId}/scoreRevisions/${latest}`);
        assert.equal(str(data.kind), 'reformat');
        assert.equal(str(data.prevRevisionId), revisionId);
        // The songbook PDF, from the reformatted pages, with the shared text fonts embedded.
        const parts = data.parts.arrayValue.values.map(v => v.mapValue.fields);
        const trumpet = parts.find(p => str(p.instrument) === 'trompete pirata');
        const svg = trumpet.svg.arrayValue.values.map(v => str(v.mapValue.fields.url));
        const download = page.waitForEvent('download', { timeout: 120000 });
        await page.evaluate(async ({ svg }) => {
            const { createSongBook } = await import('/src/createSongBook.ts');
            await createSongBook({ title: 'E2E', instrument: 'trompete pirata', coverImageUrl: '', backSheetPageNumber: false, carnivalMode: false, antiAssedioPages: false,
                sections: [{ title: 'Seção', scores: [{ score: { id: 's', title: 'All instruments', composer: '', sub: '', tags: [] },
                    revision: { parts: [{ name: 'Trompete', instrument: 'trompete pirata', svg, midi: '' }] }, index: 1 }] }] });
        }, { svg });
        const pdf = await (await download).createReadStream();
        const chunks = [];
        for await (const chunk of pdf) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString('latin1');
        assert(text.startsWith('%PDF'), 'a PDF');
        assert(/LiberationSerif/.test(text), 'the shared text fonts are embedded');
        await page.close();
    });
} finally {
    await browser.close();
    server.kill();
}
if (failures.length) {console.log(`${failures.length} case(s) failed: ${failures.join('; ')}`);}
process.exit(failures.length ? 1 : 0);
