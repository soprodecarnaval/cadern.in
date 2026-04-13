/**
 * migrateToScoresCollection.ts
 *
 * Migrates Firestore docs from `songs` → `scores` collection and copies
 * Storage files from `songs/{id}/...` → `scores/{id}/...`, updating all
 * embedded storage paths in revision documents.
 *
 * Dry-run by default. Use --execute to apply changes.
 * Use --delete-old to remove the original `songs` docs and storage files
 * after a successful migration (run separately after verifying).
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/migrateToScoresCollection.ts [--execute] [--delete-old]
 *
 * Required environment variables:
 *   STORAGE_BUCKET   Cloud Storage bucket name
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (() => {
    throw new Error("STORAGE_BUCKET not set");
  })();

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const deleteOld = args.includes("--delete-old");

function log(msg: string) {
  console.log(msg);
}

function rewritePath(storagePath: string): string {
  return storagePath.replace(/^songs\//, "scores/");
}

async function copyStorageFile(
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  src: string,
  dest: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    log(`    [dry] copy storage: ${src} → ${dest}`);
    return;
  }
  const [exists] = await bucket.file(dest).exists();
  if (exists) {
    log(`    ~ already exists, skipping: ${dest}`);
    return;
  }
  log(`    ^ copy: ${src} → ${dest}`);
  await bucket.file(src).copy(bucket.file(dest));
}

async function main() {
  initializeApp({ storageBucket: STORAGE_BUCKET });
  const db = getFirestore();
  const bucket = getStorage().bucket();

  if (!execute) {
    log("DRY RUN — pass --execute to apply changes\n");
  }
  if (deleteOld && !execute) {
    log("Note: --delete-old has no effect in dry-run mode\n");
  }

  const songsSnap = await db.collection("songs").get();
  log(`Found ${songsSnap.size} docs in songs collection\n`);

  let migrated = 0;
  let skipped = 0;

  for (const songDoc of songsSnap.docs) {
    const scoreId = songDoc.id;
    const scoreRef = db.collection("scores").doc(scoreId);

    log(`score: ${scoreId}`);

    const revisionsSnap = await db
      .collection("songs")
      .doc(scoreId)
      .collection("revisions")
      .get();

    for (const revDoc of revisionsSnap.docs) {
      const revId = revDoc.id;
      const rev = revDoc.data();

      const newMscz = rewritePath(rev.mscz);
      const newMetajson = rewritePath(rev.metajson);
      const newMidi = rewritePath(rev.midi);
      const newParts = rev.parts.map((p: any) => ({
        ...p,
        svg: p.svg.map(rewritePath),
        midi: rewritePath(p.midi),
      }));

      const allSrcPaths = [
        rev.mscz,
        rev.metajson,
        rev.midi,
        ...rev.parts.flatMap((p: any) => [...p.svg, p.midi]),
      ];
      const allDestPaths = [
        newMscz,
        newMetajson,
        newMidi,
        ...newParts.flatMap((p: any) => [...p.svg, p.midi]),
      ];

      log(`  revision: ${revId} (${allSrcPaths.length} files)`);

      for (let i = 0; i < allSrcPaths.length; i++) {
        await copyStorageFile(bucket, allSrcPaths[i], allDestPaths[i], !execute);
      }

      if (execute) {
        await scoreRef.collection("revisions").doc(revId).set({
          ...rev,
          mscz: newMscz,
          metajson: newMetajson,
          midi: newMidi,
          parts: newParts,
        });
        log(`  wrote firestore: scores/${scoreId}/revisions/${revId}`);
      } else {
        log(`  [dry] write firestore: scores/${scoreId}/revisions/${revId}`);
      }
    }

    if (execute) {
      await scoreRef.set(songDoc.data());
      log(`  wrote firestore: scores/${scoreId}`);
    } else {
      log(`  [dry] write firestore: scores/${scoreId}`);
    }

    if (deleteOld && execute) {
      for (const revDoc of revisionsSnap.docs) {
        await revDoc.ref.delete();
      }
      await songDoc.ref.delete();
      const prefix = `songs/${scoreId}/`;
      await bucket.deleteFiles({ prefix });
      log(`  deleted: songs/${scoreId} + storage ${prefix}`);
    }

    log("");
    migrated++;
  }

  log(`Done. ${migrated} migrated, ${skipped} skipped.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
