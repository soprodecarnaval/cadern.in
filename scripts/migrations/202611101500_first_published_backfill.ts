import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { Migration, MigrationContext } from "./lib/migration";
import { commitInChunks, type Write } from "../lib/batches";

/**
 * Backfills `scores/{id}.firstPublished` (collab-flow §008) for every score
 * currently published (`published != null`). There is no history of
 * `songbooks.isPublished` toggles, so "first published" can only be
 * approximated for scores published *right now*: among the songbooks
 * currently crediting a score, this finds the earliest `songbookRevisions`
 * doc (across that songbook's *entire* history, not just its current
 * revision) whose `pins` include the score, and credits that songbook with
 * that revision's `createdAt` as `publishedAt`.
 *
 * Scores that are not currently published are left untouched (`null`) —
 * there is no reliable signal to reconstruct whether they were ever
 * published and by whom. Scores that already carry `firstPublished` (a
 * re-run, or one the live trigger already set) are skipped; write-once
 * applies here too.
 */

interface Candidate {
  songbookId: string;
  projectId: string;
  createdAt: number;
}

/**
 * The earliest `songbookRevisions` doc of `songbookId` whose pins include
 * `scoreId`, if any.
 * @param {MigrationContext["db"]} db The database.
 * @param {string} songbookId The songbook.
 * @param {string} scoreId The score.
 * @return {Promise<Candidate | null>} The earliest match, or null.
 */
async function earliestPin(
  db: MigrationContext["db"],
  songbookId: string,
  scoreId: string,
): Promise<Candidate | null> {
  const songbook = await db.collection("songbooks").doc(songbookId).get();
  if (!songbook.exists) {
    return null;
  }
  const revisions = await songbook.ref.collection("songbookRevisions").get();
  let earliest: { createdAt: number } | null = null;
  for (const revision of revisions.docs) {
    const pins = (revision.get("pins") ?? {}) as Record<string, string>;
    if (!(scoreId in pins)) {
      continue;
    }
    const createdAt =
      (revision.get("createdAt") as Timestamp | undefined)?.toMillis() ?? 0;
    if (!earliest || createdAt < earliest.createdAt) {
      earliest = { createdAt };
    }
  }
  if (!earliest) {
    return null;
  }
  return {
    songbookId,
    projectId: songbook.get("projectId") as string,
    createdAt: earliest.createdAt,
  };
}

const migration: Migration = {
  id: "202611101500",
  description:
    "scores: backfill firstPublished from currently-published songbooks' history",

  async up({ db, dryRun }: MigrationContext) {
    const scores = await db.collection("scores").get();
    const writes: Write[] = [];
    let skippedAlreadySet = 0;
    let unresolved = 0;
    let notPublished = 0;

    for (const score of scores.docs) {
      const published = score.get("published") as
        { songbookIds: string[] } | null;
      if (!published) {
        notPublished++;
        continue;
      }
      if (score.get("firstPublished")) {
        skippedAlreadySet++;
        continue;
      }
      const candidates = (await Promise.all(
        (published?.songbookIds ?? []).map((id) => earliestPin(db, id, score.id)),
      )).filter((c): c is Candidate => c !== null);
      if (candidates.length === 0) {
        unresolved++;
        continue;
      }
      const earliest = candidates.reduce((a, b) =>
        b.createdAt < a.createdAt ? b : a);
      const fields = {
        firstPublished: {
          songbookId: earliest.songbookId,
          projectId: earliest.projectId,
          publishedAt: new Date(earliest.createdAt),
        },
      };
      if (dryRun && writes.length < 5) {
        console.log(`  [dry] ${score.ref.path}: ${JSON.stringify(fields)}`);
      }
      writes.push((batch) => batch.update(score.ref, fields));
    }

    console.log(
      `\n${writes.length} scores to backfill firstPublished, ` +
        `${skippedAlreadySet} already set, ${unresolved} published but ` +
        `unresolved (no matching songbook revision found), ${notPublished} ` +
        "not currently published (left null)",
    );
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },

  async down({ db, dryRun }: MigrationContext) {
    const scores = await db.collection("scores").get();
    const writes: Write[] = scores.docs
      .filter((score) => score.get("firstPublished"))
      .map((score) => (batch) =>
        batch.update(score.ref, { firstPublished: FieldValue.delete() }));
    console.log(`${writes.length} scores to clear firstPublished`);
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },
};

export default migration;
