import type { Migration, MigrationContext } from "../lib/migration";

/**
 * Copies every `scores/{id}/revisions/{rev}` to `scores/{id}/scoreRevisions/{rev}`
 * (collab-flow M2b). Same ids, `isLatest` dropped: the new subcollection is
 * immutable and "latest" is the score's `latestRevisionId`.
 *
 * The legacy subcollection stays — flag-off code reads it, and uploads keep
 * writing both — until it is dropped in M9. Copies overwrite, so re-running is
 * harmless.
 */

const LEGACY = "revisions";
const TARGET = "scoreRevisions";

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 400;

type Write = (batch: FirebaseFirestore.WriteBatch) => void;

async function commitInChunks(
  db: MigrationContext["db"],
  writes: Write[],
): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const write of chunk) {
      write(batch);
    }
    await batch.commit();
    console.log(`  committed ${i + chunk.length}/${writes.length}`);
  }
}

/** Only revisions directly under `scores/{id}` — not any other `revisions`. */
function scoreOf(ref: FirebaseFirestore.DocumentReference) {
  const score = ref.parent.parent;
  return score?.parent.id === "scores" ? score : null;
}

const migration: Migration = {
  id: "202610041500",
  description: "scores/*/revisions → scores/*/scoreRevisions (copy, drop isLatest)",

  async up(ctx: MigrationContext) {
    const { db, dryRun } = ctx;

    const revs = await db.collectionGroup(LEGACY).get();
    console.log(`Found ${revs.size} legacy revisions`);

    const writes: Write[] = [];
    for (const revSnap of revs.docs) {
      const score = scoreOf(revSnap.ref);
      if (!score) {
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isLatest, ...data } = revSnap.data();
      const target = score.collection(TARGET).doc(revSnap.id);
      if (dryRun) {
        console.log(`  [dry] ${score.id}/${revSnap.id}`);
      }
      writes.push((batch) => batch.set(target, data));
    }

    console.log(`\n${writes.length} revisions to copy`);
    if (dryRun) {
      return;
    }
    await commitInChunks(db, writes);
  },

  async down(ctx: MigrationContext) {
    const { db, dryRun } = ctx;

    const revs = await db.collectionGroup(TARGET).get();
    const refs = revs.docs.map((d) => d.ref).filter((ref) => scoreOf(ref));

    console.log(`${refs.length} copies to delete`);
    if (dryRun) {
      return;
    }
    await commitInChunks(
      db,
      refs.map((ref) => (batch) => batch.delete(ref)),
    );
  },
};

export default migration;
