/**
 * Recomputes every score's `published` marker from the songbooks (collab-flow
 * §2.2.1) — for migrations and to repair drift. Not deployed: only exports of
 * src/index.ts are.
 *
 * Usage (from the repo root):
 *   npm --prefix functions run rebuild:published            # dry run
 *   npm --prefix functions run rebuild:published -- --execute
 *   ENV_FILE=.env.prod-scripts.local npm --prefix functions run ...
 *
 * Runs from the repo root, so ENV_FILE and the key path in it are relative to
 * it, as for the migration scripts.
 *
 * Reads SCRIPTS_FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS, and
 * refuses to run if the key belongs to another project.
 */

import { readFileSync } from "node:fs";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { rebuildPublished } from "../src/publishedScores";

/**
 * Initializes the Admin SDK against SCRIPTS_FIREBASE_PROJECT_ID.
 * @return {string} The project id.
 */
function init(): string {
  const projectId = process.env.SCRIPTS_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("SCRIPTS_FIREBASE_PROJECT_ID is not set.");
  }
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentials) {
    const key = JSON.parse(readFileSync(credentials, "utf8"));
    if (key.project_id && key.project_id !== projectId) {
      throw new Error(`${credentials} is for "${key.project_id}", ` +
        `but SCRIPTS_FIREBASE_PROJECT_ID is "${projectId}".`);
    }
  }
  initializeApp({ credential: applicationDefault(), projectId });
  return projectId;
}

/** Runs the rebuild. */
async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  console.log(`Firebase project: ${init()}`);
  if (!execute) {
    console.log("DRY RUN — pass --execute to apply changes\n");
  }
  const changes = await rebuildPublished(getFirestore(), !execute);
  for (const { scoreId, before, after } of changes) {
    console.log(`  ${scoreId}: ${JSON.stringify(before)} → ` +
      `${JSON.stringify(after)}`);
  }
  const verb = execute ? "updated" : "to update";
  console.log(`\n${changes.length} marker(s) ${verb}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
