/**
 * Usage:
 *   tsx --env-file=.env.local scripts/migrate.ts [--to <id>] [--execute]
 *   tsx --env-file=.env.local scripts/migrate.ts cleanup [--execute]
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
import { getSchema, setVersion, setCleanedVersion } from "./lib/migration";
import type { MigrationContext } from "./lib/migration";
import { FIRESTORE_DATABASE_ID } from "./lib/env";
import { initAdminApp } from "./lib/firebaseAdmin";
import { migrationPlan } from "./lib/migrationPlan";

const rawArgs = process.argv.slice(2);
const isCleanup = rawArgs[0] === "cleanup";
const args = isCleanup ? rawArgs.slice(1) : rawArgs;
const execute = args.includes("--execute");
const toIdx = args.indexOf("--to");
const targetId = toIdx !== -1 ? args[toIdx + 1] : null;

async function runMigrations(
  ctx: MigrationContext,
  currentVersion: string | null,
  targetId: string | null,
): Promise<void> {
  const { db, dryRun } = ctx;

  const plan = migrationPlan(
    migrations.map((migration) => migration.id), currentVersion, targetId,
    args.includes("--forward-only"),
  );
  if (plan.ids.length === 0) {
    console.log("Already at target version, nothing to do.");
    return;
  }
  for (const id of plan.ids) {
    const index = migrations.findIndex((migration) => migration.id === id);
    const migration = migrations[index];
    console.log(`\n${plan.direction}: ${id} — ${migration.description}`);
    if (plan.direction === "up") {
      await migration.up(ctx);
    } else {
      await migration.down(ctx);
    }
    const version = plan.direction === "up" ? id : migrations[index - 1]?.id ?? null;
    await setVersion(db, version, dryRun);
    console.log(`   version -> ${version ?? "(none)"}`);
  }
}

async function runCleanup(
  ctx: MigrationContext,
  currentVersion: string | null,
  cleanedVersion: string | null,
): Promise<void> {
  const { db, dryRun } = ctx;

  if (!currentVersion) {
    console.log("No migrations applied, nothing to clean up.");
    return;
  }

  const cleanedIdx = cleanedVersion
    ? migrations.findIndex((m) => m.id === cleanedVersion)
    : -1;
  const currentIdx = migrations.findIndex((m) => m.id === currentVersion);

  const toClean = migrations
    .slice(cleanedIdx + 1, currentIdx + 1)
    .filter((m) => m.cleanup);

  if (toClean.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  for (const m of toClean) {
    console.log(`\n[cleanup] ${m.id} — ${m.description}`);
    await m.cleanup!(ctx);
    await setCleanedVersion(db, m.id, dryRun);
    console.log(`   cleanedVersion -> ${m.id}`);
  }
}

async function main() {
  initAdminApp();
  const db = getFirestore(FIRESTORE_DATABASE_ID);
  const bucket = getStorage().bucket();
  const dryRun = !execute;
  const ctx: MigrationContext = { db, bucket, dryRun };

  const clone = await db.doc("_meta/stagingClone").get();
  if (clone.get("status") === "running") {
    throw new Error("Staging clone incomplete; rerun the clone before migrating");
  }

  if (dryRun) console.log("DRY RUN — pass --execute to apply changes\n");

  const schema = await getSchema(db);
  console.log(`version:        ${schema.version ?? "(none)"}`);
  console.log(`cleanedVersion: ${schema.cleanedVersion ?? "(none)"}\n`);

  if (isCleanup) {
    await runCleanup(ctx, schema.version, schema.cleanedVersion);
  } else {
    await runMigrations(ctx, schema.version, targetId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
