/**
 * Usage:
 *   tsx --env-file=.env.local scripts/migrate.ts [--to <id>] [--include-dataset] [--execute]
 *   tsx --env-file=.env.local scripts/migrate.ts cleanup [--to <id>] [--include-dataset] [--execute]
 *
 * Required environment variables:
 *   SCRIPTS_FIREBASE_PROJECT_ID       Firebase project to migrate
 *   SCRIPTS_FIREBASE_STORAGE_BUCKET   Cloud Storage bucket of that project
 *   GOOGLE_APPLICATION_CREDENTIALS    service-account key for that project
 *                                     (or `gcloud auth application-default login`)
 */

import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { migrations } from "./migrations/index";
import { getSchema } from "./lib/migration";
import type { MigrationContext } from "./lib/migration";
import { FIRESTORE_DATABASE_ID } from "./lib/env";
import { initAdminApp } from "./lib/firebaseAdmin";
import { parseMigrationOptions } from "./lib/migrationOptions";
import { runMigrations } from "./lib/migrationRunner";

const options = parseMigrationOptions(process.argv.slice(2));

async function main() {
  initAdminApp();
  const db = getFirestore(FIRESTORE_DATABASE_ID);
  const bucket = getStorage().bucket();
  const dryRun = !options.execute;
  const ctx: MigrationContext = { db, bucket, dryRun };

  const clone = await db.doc("_meta/stagingClone").get();
  if (clone.get("status") === "running") {
    throw new Error("Staging clone incomplete; rerun the clone before migrating");
  }

  if (dryRun) console.log("DRY RUN — pass --execute to apply changes\n");

  const schema = await getSchema(db);
  console.log(`version:        ${schema.version ?? "(none)"}`);
  console.log(`cleanedVersion: ${schema.cleanedVersion ?? "(none)"}\n`);

  await runMigrations(ctx, migrations, schema, options);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
