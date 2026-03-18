import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Collection, Score } from "../types.js";
import { zProjectDoc, zSongDoc, zRevisionDoc } from "../firestore-types.js";
import type { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const COLLECTION_BASE = path.join(ROOT, "public", "collection");

const CADERN_IN_UID = process.env.CADERN_IN_UID ?? (() => { throw new Error("CADERN_IN_UID not set"); })();
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? (() => { throw new Error("STORAGE_BUCKET not set"); })();

initializeApp({
  credential: applicationDefault(),
  storageBucket: STORAGE_BUCKET,
});

const db = getFirestore();
const bucket = getStorage().bucket();

function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\//g, "--")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function slugifyFilename(filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return slugify(base) + ext;
}

function revisionStoragePaths(rev: z.infer<typeof zRevisionDoc>): string[] {
  return [
    rev.mscz,
    rev.metajson,
    rev.midi,
    ...rev.parts.flatMap((p) => [...p.svg, p.midi]),
  ];
}

async function allAssetsExist(paths: string[]): Promise<boolean> {
  const results = await Promise.all(paths.map((p) => bucket.file(p).exists()));
  return results.every(([exists]) => exists);
}

async function uploadFile(localPath: string, storagePath: string): Promise<void> {
  if (!fs.existsSync(localPath)) {
    console.warn(`    ⚠ not found, skipping: ${localPath}`);
    return;
  }
  console.log(`    ↑ storage: ${storagePath}`);
  await bucket.upload(localPath, { destination: storagePath });
}

async function migrateScore(score: Score, projectId: string): Promise<void> {
  const songId = slugify(score.id);
  const revId = "1";
  const storageBase = `songs/${songId}/${revId}`;

  // Build storage paths for parts
  const migratedParts = [];
  const fileUploads: [string, string][] = [
    [score.mscz, `${storageBase}/score.mscz`],
    [score.metajson, `${storageBase}/score.metajson`],
    [score.midi, `${storageBase}/score.midi`],
  ];

  for (const part of score.parts) {
    const svgStoragePaths: string[] = [];
    for (const svg of part.svg) {
      const dest = `${storageBase}/parts/${slugifyFilename(path.basename(svg))}`;
      fileUploads.push([svg, dest]);
      svgStoragePaths.push(dest);
    }
    const midiDest = `${storageBase}/parts/${slugifyFilename(path.basename(part.midi))}`;
    fileUploads.push([part.midi, midiDest]);
    migratedParts.push({ ...part, svg: svgStoragePaths, midi: midiDest });
  }

  console.log(`  song: ${score.title} (${songId})`);

  // Skip if already migrated and all assets are present
  const songRef = db.collection("songs").doc(songId);
  const existing = await songRef.collection("revisions").doc(revId).get();
  if (existing.exists) {
    const existingRev = zRevisionDoc.parse(existing.data());
    if (await allAssetsExist(revisionStoragePaths(existingRev))) {
      console.log(`  ⏭ already migrated, skipping\n`);
      return;
    }
    console.log(`  ⚠ assets missing, re-migrating...`);
  }

  console.log(`  uploading ${fileUploads.length} files...`);
  for (const [relPath, storagePath] of fileUploads) {
    const absPath = path.join(COLLECTION_BASE, relPath);
    await uploadFile(absPath, storagePath);
  }

  console.log(`  writing firestore: songs/${songId}`);
  await songRef.set(zSongDoc.parse({
    title: score.title,
    composer: score.composer,
    sub: score.sub,
    tags: score.tags,
    projectId,
    uploadedBy: CADERN_IN_UID,
    latestRevisionId: revId,
    createdAt: FieldValue.serverTimestamp(),
  }));

  console.log(`  writing firestore: songs/${songId}/revisions/${revId}`);
  await songRef.collection("revisions").doc(revId).set(zRevisionDoc.parse({
    revisionNumber: 1,
    uploadedBy: CADERN_IN_UID,
    uploadedAt: FieldValue.serverTimestamp(),
    mscz: `${storageBase}/score.mscz`,
    metajson: `${storageBase}/score.metajson`,
    midi: `${storageBase}/score.midi`,
    parts: migratedParts,
    notes: "",
    isLatest: true,
  }));

  console.log(`  ✓ done\n`);
}

async function cleanOrphans(
  expectedSongIds: Set<string>,
  expectedProjectIds: Set<string>
): Promise<void> {
  console.log("\n🧹 Cleaning orphaned docs...");

  const [songsSnap, projectsSnap] = await Promise.all([
    db.collection("songs").get(),
    db.collection("projects").get(),
  ]);

  const orphanedSongs = songsSnap.docs.filter((d) => !expectedSongIds.has(d.id));
  const orphanedProjects = projectsSnap.docs.filter((d) => !expectedProjectIds.has(d.id));

  for (const doc of orphanedSongs) {
    console.log(`  🗑 storage: songs/${doc.id}/`);
    await bucket.deleteFiles({ prefix: `songs/${doc.id}/` });
    console.log(`  🗑 firestore: songs/${doc.id}`);
    const revisions = await doc.ref.collection("revisions").get();
    await Promise.all(revisions.docs.map((r) => r.ref.delete()));
    await doc.ref.delete();
  }

  for (const doc of orphanedProjects) {
    console.log(`  🗑 firestore: projects/${doc.id}`);
    await doc.ref.delete();
  }

  console.log(`  removed ${orphanedSongs.length} song(s), ${orphanedProjects.length} project(s)\n`);
}

async function main(): Promise<void> {
  const clean = process.argv.includes("--clean");

  const collectionPath = path.join(COLLECTION_BASE, "collection.json");
  const collection = JSON.parse(
    fs.readFileSync(collectionPath, "utf-8")
  ) as Collection;

  const expectedSongIds = new Set(
    collection.projects.flatMap((p) => p.scores.map((s) => slugify(s.id)))
  );
  const expectedProjectIds = new Set(collection.projects.map((p) => slugify(p.title)));

  if (clean) {
    await cleanOrphans(expectedSongIds, expectedProjectIds);
  }

  for (const project of collection.projects) {
    const projectId = slugify(project.title);
    console.log(`\nproject: ${project.title} (${projectId})`);
    console.log(`writing firestore: projects/${projectId}`);
    await db.collection("projects").doc(projectId).set(zProjectDoc.parse({
      title: project.title,
      ownerId: CADERN_IN_UID,
      collaboratorIds: [],
      createdAt: FieldValue.serverTimestamp(),
    }));

    for (const score of project.scores) {
      await migrateScore(score, projectId);
    }
  }

  console.log("\n✓ Migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
