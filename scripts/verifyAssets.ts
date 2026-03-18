import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { fileURLToPath } from "url";
import * as path from "path";
import { zRevisionDoc } from "../firestore-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (() => {
    throw new Error("STORAGE_BUCKET not set");
  })();

initializeApp({ credential: applicationDefault(), storageBucket: STORAGE_BUCKET });

const db = getFirestore();
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
    const songId = doc.ref.parent.parent!.id;
    const revision = zRevisionDoc.parse(doc.data());

    const paths = [
      revision.mscz,
      revision.metajson,
      revision.midi,
      ...revision.parts.flatMap((p) => [...p.svg, p.midi]),
    ];

    const results = await Promise.all(
      paths.map(async (p) => ({ path: p, exists: await fileExists(p) }))
    );

    const missing = results.filter((r) => !r.exists);
    if (missing.length > 0) {
      console.log(`✗ ${songId} / rev ${revision.revisionNumber}`);
      for (const m of missing) console.log(`    missing: ${m.path}`);
      missingTotal += missing.length;
    } else {
      console.log(`✓ ${songId} / rev ${revision.revisionNumber}`);
    }
  }

  console.log(`\n${missingTotal === 0 ? "All files present." : `${missingTotal} file(s) missing.`}`);
  process.exit(missingTotal > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
