import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { zRevisionDoc } from "../types/docs.js";
import { FIREBASE_STORAGE_BUCKET, FIRESTORE_DATABASE_ID } from "./lib/env";

initializeApp({
  credential: applicationDefault(),
  storageBucket: FIREBASE_STORAGE_BUCKET,
});

const db = getFirestore(FIRESTORE_DATABASE_ID);
const bucket = getStorage().bucket();

async function fileExists(storagePath: string): Promise<boolean> {
  const [exists] = await bucket.file(storagePath).exists();
  return exists;
}

async function main(): Promise<void> {
  const snap = await db.collectionGroup("revisions").get();
  console.log(`Checking ${snap.docs.length} revision(s)...\n`);

  let missingTotal = 0;

  for (const doc of snap.docs) {
    const scoreId = doc.ref.parent.parent!.id;
    const revision = zRevisionDoc.parse(doc.data());

    const paths = [
      revision.mscz.path,
      revision.metajson.path,
      revision.midi.path,
      ...revision.parts.flatMap((p) => [...p.svg.map((f) => f.path), p.midi.path]),
    ];

    const results = await Promise.all(
      paths.map(async (p) => ({ path: p, exists: await fileExists(p) })),
    );

    const missing = results.filter((r) => !r.exists);
    if (missing.length > 0) {
      console.log(`✗ ${scoreId} / rev ${revision.revisionNumber}`);
      for (const m of missing) console.log(`    missing: ${m.path}`);
      missingTotal += missing.length;
    } else {
      console.log(`✓ ${scoreId} / rev ${revision.revisionNumber}`);
    }
  }

  console.log(
    `\n${missingTotal === 0 ? "All files present." : `${missingTotal} file(s) missing.`}`,
  );
  process.exit(missingTotal > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
