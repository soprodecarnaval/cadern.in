import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Collection, Score } from "../types.js";
import { zProjectDoc, zSongDoc, zRevisionDoc } from "../firestore-types.js";

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
    .toLowerCase()
    .replace(/\//g, "--")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
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
      const dest = `${storageBase}/parts/${path.basename(svg)}`;
      fileUploads.push([svg, dest]);
      svgStoragePaths.push(dest);
    }
    const midiDest = `${storageBase}/parts/${path.basename(part.midi)}`;
    fileUploads.push([part.midi, midiDest]);
    migratedParts.push({ ...part, svg: svgStoragePaths, midi: midiDest });
  }

  console.log(`  song: ${score.title} (${songId})`);
  console.log(`  uploading ${fileUploads.length} files...`);
  for (const [relPath, storagePath] of fileUploads) {
    const absPath = path.join(COLLECTION_BASE, relPath);
    await uploadFile(absPath, storagePath);
  }

  console.log(`  writing firestore: songs/${songId}`);
  const songRef = db.collection("songs").doc(songId);
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
  }));

  console.log(`  ✓ done\n`);
}

async function main(): Promise<void> {
  const collectionPath = path.join(COLLECTION_BASE, "collection.json");
  const collection = JSON.parse(
    fs.readFileSync(collectionPath, "utf-8")
  ) as Collection;

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
