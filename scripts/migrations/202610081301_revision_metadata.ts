import { FieldValue } from "firebase-admin/firestore";
import type { Migration, MigrationContext } from "../lib/migration";
import { commitInChunks, type Write } from "../lib/batches";
import { isLegacyRevisionId, revisionsByScore } from "../lib/scoreRevisions";

/**
 * Moves score metadata onto revisions (collab-flow M4). Each score's current
 * top-level `title/composer/sub/tags` — what the site shows today — becomes
 * `cachedMetadata` on the score and `metadata` on every revision without one,
 * in both subcollections. No per-revision history exists, so older revisions
 * get the current values. Also sets `published: null` on scores.
 *
 * The top-level fields stay (flag-off code reads them) until M9.
 */

const migration: Migration = {
  id: "202610081301",
  description: "scores: metadata → revisions, cachedMetadata, published",

  async up({ db, dryRun }: MigrationContext) {
    const [scores, byScore] = await Promise.all([
      db.collection("scores").get(),
      revisionsByScore(db),
    ]);
    const writes: Write[] = [];
    let containers = 0;
    let revisionDocs = 0;

    for (const score of scores.docs) {
      const metadata = {
        title: score.get("title") as string,
        composer: (score.get("composer") as string | undefined) ?? "",
        sub: (score.get("sub") as string | undefined) ?? "",
        tags: (score.get("tags") as string[] | undefined) ?? [],
      };
      const containerFields: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> =
        {};
      if (score.get("cachedMetadata") === undefined) {
        containerFields.cachedMetadata = metadata;
      }
      if (score.get("published") === undefined) {
        containerFields.published = null;
      }
      if (Object.keys(containerFields).length > 0) {
        containers++;
        if (dryRun && containers <= 3) {
          console.log(
            `  [dry] scores/${score.id}: ${JSON.stringify(containerFields)}`,
          );
        }
        writes.push((batch) => batch.update(score.ref, containerFields));
      }

      for (const copies of byScore.get(score.id)?.values() ?? []) {
        for (const copy of copies) {
          if (copy.get("metadata") !== undefined) {
            continue;
          }
          revisionDocs++;
          writes.push((batch) => batch.update(copy.ref, { metadata }));
        }
      }
    }

    console.log(
      `\n${containers} of ${scores.size} scores and ${revisionDocs} revision docs to update`,
    );
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },

  async down({ db, dryRun }: MigrationContext) {
    const [scores, byScore] = await Promise.all([
      db.collection("scores").get(),
      revisionsByScore(db),
    ]);
    const writes: Write[] = scores.docs.map(
      (score) => (batch) =>
        batch.update(score.ref, {
          cachedMetadata: FieldValue.delete(),
          published: FieldValue.delete(),
        }),
    );
    for (const revisions of byScore.values()) {
      for (const [id, copies] of revisions) {
        if (!isLegacyRevisionId(id)) {
          continue;
        }
        for (const copy of copies) {
          writes.push((batch) =>
            batch.update(copy.ref, { metadata: FieldValue.delete() }),
          );
        }
      }
    }
    console.log(`${writes.length} docs to clear`);
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },
};

export default migration;
