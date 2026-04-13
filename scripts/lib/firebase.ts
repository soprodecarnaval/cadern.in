import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import path from "path";
import type { LegacyCollection, LegacyScore } from "./legacyCollectionTypes";
import { zProjectDoc, zScoreDoc, zRevisionDoc } from "../../types/docs.js";
import { SCORES_COLLECTION } from "../../constants";
import type { z } from "zod";

export interface FirebaseConfig {
  uid: string;
  storageBucket: string;
}

export interface SeedOptions {
  clean: boolean;
}

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
  return slugify(path.basename(filename, ext)) + ext;
}

function revisionStoragePaths(rev: z.infer<typeof zRevisionDoc>): string[] {
  return [
    rev.mscz,
    rev.metajson,
    rev.midi,
    ...rev.parts.flatMap((p) => [...p.svg, p.midi]),
  ];
}

async function allAssetsExist(
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  paths: string[]
): Promise<boolean> {
  const results = await Promise.all(paths.map((p) => bucket.file(p).exists()));
  return results.every(([exists]) => exists);
}

async function uploadFile(
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  localPath: string,
  storagePath: string
): Promise<void> {
  if (!fs.existsSync(localPath)) {
    console.warn(`    ! not found, skipping: ${localPath}`);
    return;
  }
  console.log(`    ^ storage: ${storagePath}`);
  await bucket.upload(localPath, { destination: storagePath });
}

async function uploadScore(
  db: FirebaseFirestore.Firestore,
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  collectionBase: string,
  score: LegacyScore,
  projectId: string,
  uid: string
): Promise<void> {
  const scoreId = slugify(score.id);
  const revId = "1";
  const storageBase = `scores/${scoreId}/${revId}`;

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

  console.log(`  song: ${score.title} (${scoreId})`);

  const songRef = db.collection(SCORES_COLLECTION).doc(scoreId);
  const existing = await songRef.collection("revisions").doc(revId).get();
  if (existing.exists) {
    const existingRev = zRevisionDoc.parse(existing.data());
    if (await allAssetsExist(bucket, revisionStoragePaths(existingRev))) {
      console.log(`  - already uploaded, skipping\n`);
      return;
    }
    console.log(`  ! assets missing, re-uploading...`);
  }

  console.log(`  uploading ${fileUploads.length} files...`);
  for (const [relPath, storagePath] of fileUploads) {
    await uploadFile(bucket, path.join(collectionBase, relPath), storagePath);
  }

  console.log(`  writing firestore: scores/${scoreId}`);
  await songRef.set(
    zScoreDoc.parse({
      title: score.title,
      composer: score.composer,
      sub: score.sub,
      tags: score.tags,
      projectId,
      uploadedBy: uid,
      latestRevisionId: revId,
      createdAt: FieldValue.serverTimestamp(),
    })
  );

  console.log(`  writing firestore: scores/${scoreId}/revisions/${revId}`);
  await songRef.collection("revisions").doc(revId).set(
    zRevisionDoc.parse({
      revisionNumber: 1,
      uploadedBy: uid,
      uploadedAt: FieldValue.serverTimestamp(),
      mscz: `${storageBase}/score.mscz`,
      metajson: `${storageBase}/score.metajson`,
      midi: `${storageBase}/score.midi`,
      parts: migratedParts,
      notes: "",
      isLatest: true,
    })
  );

  console.log(`  done\n`);
}

async function cleanOrphans(
  db: FirebaseFirestore.Firestore,
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  expectedSongIds: Set<string>,
  expectedProjectIds: Set<string>
): Promise<void> {
  console.log("\nCleaning orphaned docs...");

  const [songsSnap, projectsSnap] = await Promise.all([
    db.collection(SCORES_COLLECTION).get(),
    db.collection("projects").get(),
  ]);

  const orphanedSongs = songsSnap.docs.filter((d) => !expectedSongIds.has(d.id));
  const orphanedProjects = projectsSnap.docs.filter((d) => !expectedProjectIds.has(d.id));

  for (const doc of orphanedSongs) {
    console.log(`  deleting storage: scores/${doc.id}/`);
    await bucket.deleteFiles({ prefix: `scores/${doc.id}/` });
    console.log(`  deleting firestore: scores/${doc.id}`);
    const revisions = await doc.ref.collection("revisions").get();
    await Promise.all(revisions.docs.map((r) => r.ref.delete()));
    await doc.ref.delete();
  }

  for (const doc of orphanedProjects) {
    console.log(`  deleting firestore: projects/${doc.id}`);
    await doc.ref.delete();
  }

  console.log(`  removed ${orphanedSongs.length} song(s), ${orphanedProjects.length} project(s)\n`);
}

/**
 * Uploads a collection's assets to Cloud Storage and indexes it in Firestore.
 * collectionBase is the directory containing collection.json and all asset files.
 */
export async function seedToFirebase(
  collectionBase: string,
  collection: LegacyCollection,
  config: FirebaseConfig,
  opts: SeedOptions
): Promise<void> {
  // Uses Application Default Credentials (ADC). Before running, authenticate via:
  //   gcloud auth application-default login
  // Or set the GOOGLE_APPLICATION_CREDENTIALS env var to a service account key file.
  initializeApp({ credential: undefined, storageBucket: config.storageBucket });

  const db = getFirestore();
  const bucket = getStorage().bucket();

  const expectedSongIds = new Set(
    collection.projects.flatMap((p) => p.scores.map((s) => slugify(s.id)))
  );
  const expectedProjectIds = new Set(collection.projects.map((p) => slugify(p.title)));

  if (opts.clean) {
    await cleanOrphans(db, bucket, expectedSongIds, expectedProjectIds);
  }

  for (const project of collection.projects) {
    const projectId = slugify(project.title);
    console.log(`\nproject: ${project.title} (${projectId})`);
    console.log(`writing firestore: projects/${projectId}`);
    await db.collection("projects").doc(projectId).set(
      zProjectDoc.parse({
        title: project.title,
        ownerId: config.uid,
        collaboratorIds: [],
        createdAt: FieldValue.serverTimestamp(),
      })
    );
    for (const score of project.scores) {
      await uploadScore(db, bucket, collectionBase, score, projectId, config.uid);
    }
  }
}
