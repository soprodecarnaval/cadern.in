import type { Migration } from "../lib/migration";
import { CADERNIN_UID } from "../lib/env";
import { loadCollabCatalog } from "../lib/collabCatalog";
import { migrateSongbooks } from "../lib/collabSongbooks";

const migration: Migration = {
  id: "202610311301",
  kind: "dataset",
  description: "M7: published songbooks per project/year, latest pins and frozen numbering",
  async up({ db, dryRun }) {
    await migrateSongbooks(db, await loadCollabCatalog(db), CADERNIN_UID, dryRun);
  },
  async down() {
    throw new Error("M7 has no automatic rollback: migrated songbooks may have been edited. Restore the pre-migration backup.");
  },
};

export default migration;
