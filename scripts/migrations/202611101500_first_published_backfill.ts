import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { Migration, MigrationContext } from "./lib/migration";
import { commitInChunks, type Write } from "../lib/batches";

/**
 * Backfills `scores/{id}.firstPublished` (collab-flow §008). There is no
 * history of `songbooks.isPublished` toggles, so "was this songbook
 * published back then" can never be reconstructed. Rather than only credit
 * the subset of scores that happen to be published *right now*, every score
 * is treated as published for backfill purposes: this scans the *entire*
 * revision history of *every* songbook (current `isPublished` value
 * ignored) and credits, per score, whichever songbook's earliest
 * `songbookRevisions` doc pinned it, using that revision's `createdAt` as
 * `publishedAt`.
 *
 * A score never pinned by any songbook revision gets `firstPublished: null`
 * — there's genuinely nothing to credit. Scores that already carry
 * `firstPublished` (a re-run, or one the live trigger already set) are
 * skipped; write-once applies here too.
 */

interface Candidate {
  songbookId: string;
  projectId: string;
  createdAt: number;
}

/**
 * Per score id, the earliest `songbookRevisions` doc across every songbook
 * (regardless of its current `isPublished`) whose pins include it.
 * @param {MigrationContext["db"]} db The database.
 * @return {Promise<Map<string, Candidate>>} Earliest candidate per score id.
 */
async function earliestPinsByScore(
  db: MigrationContext["db"],
): Promise<Map<string, Candidate>> {
  const songbooks = await db.collection("songbooks").get();
  const earliest = new Map<string, Candidate>();

  for (const songbook of songbooks.docs) {
    const projectId = songbook.get("projectId") as string;
    const revisions = await songbook.ref.collection("songbookRevisions").get();
    for (const revision of revisions.docs) {
      const pins = (revision.get("pins") ?? {}) as Record<string, string>;
      const createdAt =
        (revision.get("createdAt") as Timestamp | undefined)?.toMillis() ?? 0;
      for (const scoreId of Object.keys(pins)) {
        const current = earliest.get(scoreId);
        if (!current || createdAt < current.createdAt) {
          earliest.set(scoreId, { songbookId: songbook.id, projectId, createdAt });
        }
      }
    }
  }
  return earliest;
}

const migration: Migration = {
  id: "202611101500",
  description: "scores: backfill firstPublished from all songbook revision history",

  async up({ db, dryRun }: MigrationContext) {
    const [scores, earliestByScore] = await Promise.all([
      db.collection("scores").get(),
      earliestPinsByScore(db),
    ]);
    const writes: Write[] = [];
    let skippedAlreadySet = 0;
    let neverPinned = 0;

    for (const score of scores.docs) {
      if (score.get("firstPublished")) {
        skippedAlreadySet++;
        continue;
      }
      const earliest = earliestByScore.get(score.id);
      if (!earliest) {
        neverPinned++;
        continue;
      }
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
        `${skippedAlreadySet} already set, ${neverPinned} never pinned by ` +
        "any songbook revision (left null)",
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
