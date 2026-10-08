import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { Migration, MigrationContext } from "../lib/migration";
import { commitInChunks, type Write } from "../lib/batches";
import { isLegacyRevisionId, revisionsByScore } from "../lib/scoreRevisions";
import { revisionSlug } from "../../src/lib/revisionId";

/**
 * Links existing revisions into a chain (collab-flow M3): `prevRevisionId` by
 * `revisionNumber` order, a `slug` from the score title and upload time, and
 * `origin: upload` for all — nothing was forked before this. Written to both
 * revision subcollections; revisions that already have `prevRevisionId` are
 * left alone, so re-running is harmless.
 */

const migration: Migration = {
  id: "202610081300",
  description: "revisions: backfill prevRevisionId, slug, origin",

  async up({ db, dryRun }: MigrationContext) {
    const [scores, byScore] = await Promise.all([
      db.collection("scores").get(),
      revisionsByScore(db),
    ]);
    const writes: Write[] = [];
    let mismatched = 0;

    for (const score of scores.docs) {
      const revisions = byScore.get(score.id);
      if (!revisions) {
        continue;
      }
      const ordered = [...revisions.entries()].sort(
        ([, a], [, b]) =>
          (a[0].get("revisionNumber") as number) -
          (b[0].get("revisionNumber") as number),
      );
      const latest = ordered[ordered.length - 1]?.[0];
      if (latest !== score.get("latestRevisionId")) {
        mismatched++;
        console.warn(
          `  ! ${score.id}: latestRevisionId ${score.get("latestRevisionId")}, highest revision ${latest}`,
        );
      }

      ordered.forEach(([, copies], i) => {
        const uploadedAt = copies[0].get("uploadedAt") as Timestamp | undefined;
        const fields = {
          prevRevisionId: i === 0 ? null : ordered[i - 1][0],
          slug: revisionSlug(
            score.get("title") as string,
            uploadedAt?.toDate() ?? new Date(0),
          ),
          origin: { type: "upload" },
        };
        for (const copy of copies) {
          if (copy.get("prevRevisionId") !== undefined) {
            continue;
          }
          if (dryRun && i < 2) {
            console.log(`  [dry] ${copy.ref.path}: ${JSON.stringify(fields)}`);
          }
          writes.push((batch) => batch.update(copy.ref, fields));
        }
      });
    }

    console.log(
      `\n${writes.length} revision docs to update across ${scores.size} scores` +
        (mismatched
          ? `; ${mismatched} scores whose pointer isn't the highest revision`
          : ""),
    );
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },

  async down({ db, dryRun }: MigrationContext) {
    const byScore = await revisionsByScore(db);
    const writes: Write[] = [];
    for (const revisions of byScore.values()) {
      for (const [id, copies] of revisions) {
        if (!isLegacyRevisionId(id)) {
          continue;
        }
        for (const copy of copies) {
          writes.push((batch) =>
            batch.update(copy.ref, {
              prevRevisionId: FieldValue.delete(),
              slug: FieldValue.delete(),
              origin: FieldValue.delete(),
            }),
          );
        }
      }
    }
    console.log(`${writes.length} revision docs to clear`);
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },
};

export default migration;
