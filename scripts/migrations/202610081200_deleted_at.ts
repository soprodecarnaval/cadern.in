import { FieldValue } from "firebase-admin/firestore";
import type { Migration, MigrationContext } from "../lib/migration";
import { commitInChunks, type Write } from "../lib/batches";

/**
 * Backfills `deletedAt: null` on projects and songbooks (collab-flow M1), so
 * soft deletes can be filtered with `where("deletedAt", "==", null)` — which
 * does not match documents missing the field.
 */

const COLLECTIONS = ["projects", "songbooks"];

const migration: Migration = {
  id: "202610081200",
  description: "projects, songbooks: backfill deletedAt: null",

  async up({ db, dryRun }: MigrationContext) {
    const writes: Write[] = [];
    for (const name of COLLECTIONS) {
      const snap = await db.collection(name).get();
      const missing = snap.docs.filter((d) => d.get("deletedAt") === undefined);
      console.log(`${name}: ${missing.length} of ${snap.size} to backfill`);
      for (const d of missing) {
        writes.push((batch) => batch.update(d.ref, { deletedAt: null }));
      }
    }
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },

  async down({ db, dryRun }: MigrationContext) {
    const writes: Write[] = [];
    for (const name of COLLECTIONS) {
      const snap = await db
        .collection(name)
        .where("deletedAt", "==", null)
        .get();
      console.log(`${name}: ${snap.size} to clear`);
      for (const d of snap.docs) {
        writes.push((batch) =>
          batch.update(d.ref, { deletedAt: FieldValue.delete() }),
        );
      }
    }
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },
};

export default migration;
