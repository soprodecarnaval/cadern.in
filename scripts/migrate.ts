/**
 * Usage:
 *   tsx --env-file=.env.local scripts/migrate.ts [--to <id>] [--execute]
 *   tsx --env-file=.env.local scripts/migrate.ts cleanup [--execute]
 *
 * Required environment variables:
 *   VITE_FIREBASE_STORAGE_BUCKET   Cloud Storage bucket name
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { migrations } from "./migrations/index";
import { getSchema, setVersion, setCleanedVersion } from "./lib/migration";
import type { MigrationContext } from "./lib/migration";

const SCRIPTS_FIREBASE_STORAGE_BUCKET =
  process.env.SCRIPTS_FIREBASE_STORAGE_BUCKET ??
  (() => {
    throw new Error("VITE_FIREBASE_STORAGE_BUCKET not set");
  })();

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

  const currentIdx = currentVersion
    ? migrations.findIndex((m) => m.id === currentVersion)
    : -1;

  const targetIdx =
    targetId !== null
      ? migrations.findIndex((m) => m.id === targetId)
      : migrations.length - 1;

  if (targetId !== null && targetIdx === -1) {
    throw new Error(`Migration not found: ${targetId}`);
  }

  if (currentIdx === targetIdx) {
    console.log("Already at target version, nothing to do.");
    return;
  }

  if (targetIdx > currentIdx) {
    for (let i = currentIdx + 1; i <= targetIdx; i++) {
      const m = migrations[i];
      console.log(`\n-> up: ${m.id} — ${m.description}`);
      await m.up(ctx);
      await setVersion(db, m.id, dryRun);
      console.log(`   version -> ${m.id}`);
    }
  } else {
    for (let i = currentIdx; i > targetIdx; i--) {
      const m = migrations[i];
      console.log(`\n<- down: ${m.id} — ${m.description}`);
      await m.down(ctx);
      const prevVersion = i > 0 ? migrations[i - 1].id : null;
      await setVersion(db, prevVersion, dryRun);
      console.log(`   version -> ${prevVersion ?? "(none)"}`);
    }
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
  initializeApp({ storageBucket: SCRIPTS_FIREBASE_STORAGE_BUCKET });
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const dryRun = !execute;
  const ctx: MigrationContext = { db, bucket, dryRun };

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
