import type { Migration, MigrationContext } from "../lib/migration";
import { commitInChunks } from "../lib/batches";

/**
 * Deletes the legacy top-level `invitations/{autoId}` collection (collab-flow
 * M1c). Invitations now live at `projects/{id}/invitations/{invitee}`; the old
 * ones are not carried over, since every project that predates the
 * collaborative flow is deleted when it ships to production.
 */

const migration: Migration = {
  id: "202610081202",
  description: "delete legacy top-level invitations",

  async up({ db, dryRun }: MigrationContext) {
    const snap = await db.collection("invitations").get();
    console.log(`${snap.size} legacy invitations to delete`);
    if (!dryRun) {
      await commitInChunks(
        db,
        snap.docs.map((d) => (batch) => batch.delete(d.ref)),
      );
    }
  },

  async down() {
    console.log("Deleted invitations cannot be restored; nothing to do.");
  },
};

export default migration;
