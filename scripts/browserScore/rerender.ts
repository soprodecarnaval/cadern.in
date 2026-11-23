// Re-render stored revisions in the browser pipeline (ticket 013), for when the
// formatting profile or the renderer changes, or to migrate plugin-formatted
// scores. Dry-run by default: the pages go to a review folder. With --write,
// each score gets a new revision marked as a reformat, with the same .mscz
// (re-stamped), as the send screen's Reformatar does.
//
//   npm run browser-score:assets
//   npx tsx --env-file=.env.local scripts/browserScore/rerender.ts --score <id> [--score <id>…]
//   npx tsx --env-file=.env.local scripts/browserScore/rerender.ts --project <id>
// Options:
//   --revision <id>    revision to re-render (one score only; default: the latest)
//   --profile <file>   FormattingProfile JSON (default: the one stored with the revision, else the default)
//   --results <dir>    review folder (default test-results/browser-score-rerender)
//   --write            create the reformat revisions after the review
//   --emulators        use the local Firebase emulators (demo-cadernin)
// Env: SCRIPTS_FIREBASE_PROJECT_ID, SCRIPTS_FIREBASE_STORAGE_BUCKET, SCRIPTS_CADERNIN_UID
// (uploadedBy of written revisions), GOOGLE_APPLICATION_CREDENTIALS; CHROME.
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "esbuild";
import { chromium } from "playwright-core";

const { values: args } = parseArgs({
  options: {
    score: { type: "string", multiple: true },
    project: { type: "string" },
    revision: { type: "string" },
    profile: { type: "string" },
    results: { type: "string" },
    write: { type: "boolean", default: false },
    emulators: { type: "boolean", default: false },
  },
});
if (args.emulators) {
  Object.assign(process.env, {
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    SCRIPTS_FIREBASE_PROJECT_ID: "demo-cadernin",
    SCRIPTS_FIREBASE_STORAGE_BUCKET: "demo-cadernin.appspot.com",
    SCRIPTS_CADERNIN_UID: process.env.SCRIPTS_CADERNIN_UID ?? "rerender",
  });
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
if (!args.score?.length && !args.project) {throw new Error("Pass --score <id> or --project <id>.");}
if (args.revision && args.score?.length !== 1) {throw new Error("--revision needs exactly one --score.");}

// Imported after the env is set: they read it on load.
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
const { getDownloadURL, getStorage } = await import("firebase-admin/storage");
const { initializeApp } = await import("firebase-admin/app");
const { initAdminApp } = await import("../lib/firebaseAdmin");
const { CADERNIN_UID } = await import("../lib/env");
const { zScoreDoc, zScoreRevisionDoc } = await import("../../types/docs");
const { zMetajson } = await import("../../types/metajson");
const { zFormattingProfile, DEFAULT_FORMATTING_PROFILE } = await import("../../types/formattingProfile");
const { stampMsczIdentityBytes } = await import("../../src/lib/msczIdentity");
const { newRevisionId, revisionSlug } = await import("../../src/lib/revisionId");
const { scoreRevisionStoragePath } = await import("../../src/lib/storagePaths");

const app = args.emulators
  ? initializeApp({ projectId: "demo-cadernin", storageBucket: "demo-cadernin.appspot.com" })
  : initAdminApp();
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const fixedProfile = args.profile ? zFormattingProfile.parse(JSON.parse(await readFile(args.profile, "utf8"))) : null;
const results = resolve(args.results ?? "test-results/browser-score-rerender");
await rm(results, { recursive: true, force: true });
await mkdir(results, { recursive: true });

const scoreIds = args.score?.length
  ? args.score
  : (await db.collection("scores").where("projectId", "==", args.project).get()).docs
      .filter((doc) => !doc.get("deletedAt"))
      .map((doc) => doc.id);

// The browser pipeline, served with the engine assets to headless Chrome.
const bundle = (await build({
  stdin: {
    contents: `
      export { renderForUpload } from './src/lib/scoreRender/renderForUpload.ts';
      export { createScoreLibrary } from './src/lib/browserScore/index.ts';
      export { libraryOptionsFor } from './src/lib/scoreRender/profile.ts';
      export { partRows, rowsFromStored, choicesFrom } from './src/tsx/screens/upload/enviarState.ts';`,
    resolveDir: resolve("."),
    loader: "ts",
  },
  bundle: true, format: "esm", platform: "browser", target: "es2022", write: false,
})).outputFiles[0].contents;
const assets = resolve("public/browser-score");
const server = createServer(async (request, response) => {
  const name = new URL(request.url ?? "/", "http://localhost").pathname;
  if (name === "/") { response.setHeader("Content-Type", "text/html"); return response.end("<!doctype html><title>Rerender</title>"); }
  if (name === "/browser.js") { response.setHeader("Content-Type", "text/javascript"); return response.end(bundle); }
  const path = resolve("public" + name);
  if (!path.startsWith(assets + "/")) {return response.writeHead(403).end();}
  try {
    response.setHeader("Content-Type", extname(path) === ".wasm" ? "application/wasm" : [".js", ".mjs"].includes(extname(path)) ? "text/javascript" : "application/octet-stream");
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: true });

type Rendered = {
  title: string; composer: string; sub: string; tags: string[];
  parts: { name: string; basename: string; instrument: string; svg: string[]; midi: string }[];
  files: { key: string; name: string; type: string; bytes: number[] }[];
  report: { name: string; pages: number; staff: number | null; warnings: string[] }[];
};

const summary: Record<string, unknown>[] = [];
let failures = 0;
try {
  for (const scoreId of scoreIds) {
    const label = `score ${scoreId}`;
    try {
      const score = zScoreDoc.parse((await db.doc(`scores/${scoreId}`).get()).data());
      const revisionId = args.revision ?? score.latestRevisionId;
      const revision = zScoreRevisionDoc.parse((await db.doc(`scores/${scoreId}/scoreRevisions/${revisionId}`).get()).data());
      const [mscz] = await bucket.file(revision.mscz.path).download();
      const stored = revision.metajson.path
        ? zMetajson.safeParse(JSON.parse((await bucket.file(revision.metajson.path).download())[0].toString("utf8")))
        : null;
      const manifest = stored?.success ? stored.data : null;
      const profile = fixedProfile ?? manifest?.formatting ?? DEFAULT_FORMATTING_PROFILE;
      const title = revision.metadata?.title ?? score.title;
      const page = await browser.newPage();
      await page.goto(origin + "/");
      const rendered = await page.evaluate(async ({ bytes, title, profile, storedParts }) => {
        // @ts-expect-error served by the script's own server
        const m = await import("/browser.js");
        const data = new Uint8Array(bytes);
        const library = await m.createScoreLibrary({ adapter: "webmscore-1.2.1", execution: "worker", ...m.libraryOptionsFor(profile),
          assets: { manifestUrl: new URL("/browser-score/manifest.json", location.href), workerUrl: new URL("/browser-score/worker.js", location.href) } });
        try {
          const session = await library.open({ bytes: data, format: "mscz", name: `${title}.mscz` }, { compatibility: "allowUnverified" });
          const catalog = await session.prepareParts({ policy: "preserveExistingOrGenerateIfNone", expectedRevision: 0 });
          await session.dispose();
          const choices = m.choicesFrom(m.rowsFromStored(m.partRows(catalog.parts), storedParts, profile));
          const { parsed, report } = await m.renderForUpload(data, `${title}.mscz`, profile, choices, { library });
          const files = await Promise.all([...parsed.fileMap].map(async ([key, file]: [string, File]) =>
            ({ key, name: file.name, type: file.type, bytes: [...new Uint8Array(await file.arrayBuffer())] })));
          return { title: parsed.title, composer: parsed.composer, sub: parsed.sub, tags: parsed.tags, parts: parsed.parts, files,
            report: report.parts.map((p: { name: string; pages: number; layout: { staffSpaceMm: number } | null; warnings: { code: string }[] }) =>
              ({ name: p.name, pages: p.pages, staff: p.layout?.staffSpaceMm ?? null, warnings: p.warnings.map((w) => w.code) })) };
        } finally { await library.dispose(); }
      }, { bytes: [...mscz], title, profile, storedParts: manifest?.parts ?? [] }) as Rendered;
      await page.close();

      const folder = resolve(results, scoreId);
      await mkdir(resolve(folder, "parts"), { recursive: true });
      for (const file of rendered.files) {await writeFile(resolve(folder, file.key.startsWith("parts/") ? file.key : file.name), new Uint8Array(file.bytes));}
      const entry: Record<string, unknown> = { scoreId, baseRevisionId: revisionId, storedProfile: !!manifest?.formatting, parts: rendered.report };

      if (args.write) {
        // Staleness gate: only reformat the revision that is still the latest.
        const latest = zScoreDoc.parse((await db.doc(`scores/${scoreId}`).get()).data()).latestRevisionId;
        if (latest !== revisionId) {throw new Error(`the latest revision moved to ${latest}; not written`);}
        const slug = revisionSlug(rendered.title, new Date());
        const newId = newRevisionId(slug);
        const base = scoreRevisionStoragePath(score.projectId, scoreId, newId);
        const stored: Record<string, { path: string; url: string }> = {};
        for (const file of rendered.files) {
          const path = file.key === "mscz" ? `${base}/score.mscz` : file.key === "metajson" ? `${base}/score.metajson` : file.key === "midi" ? `${base}/score.midi` : `${base}/${file.key}`;
          const bytes = file.key === "mscz" ? stampMsczIdentityBytes(new Uint8Array(file.bytes), { scoreId, revisionId: newId }) : new Uint8Array(file.bytes);
          const object = bucket.file(path);
          await object.save(Buffer.from(bytes), { contentType: file.type || "application/octet-stream" });
          stored[file.key] = { path, url: await getDownloadURL(object) };
        }
        const metadata = { title: rendered.title, composer: rendered.composer, sub: rendered.sub, tags: rendered.tags };
        const missing = (key: string) => ({ path: key, url: "" });
        await db.runTransaction(async (tx) => {
          const current = zScoreDoc.parse((await tx.get(db.doc(`scores/${scoreId}`))).data());
          if (current.latestRevisionId !== revisionId) {throw new Error("the latest revision moved during the write");}
          const previous = zScoreRevisionDoc.parse((await tx.get(db.doc(`scores/${scoreId}/revisions/${revisionId}`))).data());
          const data = {
            revisionNumber: previous.revisionNumber + 1, prevRevisionId: revisionId, uploadedBy: CADERNIN_UID, slug, metadata,
            origin: { type: "upload" }, kind: "reformat", notes: "",
            mscz: stored.mscz ?? missing("mscz"), metajson: stored.metajson ?? missing("metajson"), midi: stored.midi ?? missing("midi"),
            parts: rendered.parts.map((part) => ({ name: part.name, instrument: part.instrument,
              svg: part.svg.map((key) => stored[key] ?? missing(key)), midi: stored[part.midi] ?? missing(part.midi) })),
          };
          tx.set(db.doc(`scores/${scoreId}/scoreRevisions/${newId}`), { ...data, uploadedAt: FieldValue.serverTimestamp() });
          tx.set(db.doc(`scores/${scoreId}/revisions/${newId}`), { ...data, isLatest: true, uploadedAt: FieldValue.serverTimestamp() });
          tx.update(db.doc(`scores/${scoreId}/revisions/${revisionId}`), { isLatest: false });
          tx.update(db.doc(`scores/${scoreId}`), { latestRevisionId: newId, cachedMetadata: metadata, ...metadata });
        });
        entry.written = newId;
      }
      summary.push(entry);
      // Fidelity notes are on every page; the console shows the rest.
      const notable = (codes: string[]) => codes.filter((code) => !/FIDELITY_UNVERIFIED|RENDERED_FROM_MUSICXML|FROM_FULL_SCORE/.test(code));
      const pages = rendered.report.map((p) => `${p.name} ${p.pages}p ${p.staff?.toFixed(2) ?? "?"}mm${notable(p.warnings).length ? ` [${notable(p.warnings).join(",")}]` : ""}`).join("; ");
      console.log(`${label} (${revisionId}${manifest?.formatting ? "" : ", default profile"}): ${pages}${entry.written ? ` → written as ${String(entry.written)}` : ""}`);
    } catch (error) {
      failures++;
      summary.push({ scoreId, error: String(error) });
      console.log(`${label}: FAILED ${String(error)}`);
    }
  }
} finally {
  await browser.close();
  server.close();
  await writeFile(resolve(results, "report.json"), JSON.stringify(summary, null, 2) + "\n");
}
console.log(`${args.write ? "Written" : "Dry run; nothing written"}. Review: ${results}`);
if (failures) {process.exit(1);}
