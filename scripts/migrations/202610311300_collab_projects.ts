import type { Migration } from "../lib/migration";
import { CADERNIN_UID } from "../lib/env";
import { loadCollabCatalog, reportAssignments } from "../lib/collabCatalog";
import { migrateProjects } from "../lib/collabProjects";

const migration: Migration = {
  id: "202610311300",
  kind: "dataset",
  description: "M6: reconcile band projects, journal score assignments, archive empty sources",
  async up({ db, dryRun }) {
    const catalog = await loadCollabCatalog(db);
    reportAssignments(catalog.assignments);
    await migrateProjects(db, catalog, CADERNIN_UID, dryRun);
  },
  async down() {
    throw new Error("M6 has no automatic rollback. Restore the pre-migration backup; original assignments remain in _meta/collabFlow/projects.");
  },
};

export default migration;
