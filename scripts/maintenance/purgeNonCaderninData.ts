/**
 * Hard-deletes every project except CADERNIN's own (any project shared with
 * other members is purged too, even if CADERNIN is a collaborator on it),
 * and every Firebase Auth user except CADERNIN. Cascades Firestore
 * subcollections (scoreRevisions/comments, songbookRevisions, members,
 * invitations) via recursiveDelete, and removes the matching Storage
 * objects (`projects/{slug}/...`, `avatars/{uid}`).
 *
 * Staging only — refuses to run against the production Firebase project.
 *
 * Usage:
 *   tsx --env-file=.env.staging scripts/maintenance/purgeNonCaderninData.ts        (dry run)
 *   tsx --env-file=.env.staging scripts/maintenance/purgeNonCaderninData.ts --yes  (execute)
 */

import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { CADERNIN_UID, FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID } from "../lib/env";
import { initAdminApp } from "../lib/firebaseAdmin";

const PRODUCTION_PROJECT_ID = "cadernin-6c0d1";
const EXPECTED_PROJECT_ID = "cadernin-staging";

async function listAllUsers(): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--yes");

  if (FIREBASE_PROJECT_ID === PRODUCTION_PROJECT_ID) {
    throw new Error("Refusing to run against the production Firebase project");
  }
  if (FIREBASE_PROJECT_ID !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `This script only runs against "${EXPECTED_PROJECT_ID}", got "${FIREBASE_PROJECT_ID}"`,
    );
  }

  initAdminApp();
  const db = getFirestore(FIRESTORE_DATABASE_ID);
  const bucket = getStorage().bucket();

  const projectsSnap = await db.collection("projects").get();
  const deleteProjects = projectsSnap.docs.filter((p) => {
    const memberIds = (p.get("memberIds") as string[] | undefined) ?? [];
    const isCaderninOnly = memberIds.length === 1 && memberIds[0] === CADERNIN_UID;
    return !isCaderninOnly;
  });

  const [scoresSnap, songbooksSnap, allUsers] = await Promise.all([
    db.collection("scores").get(),
    db.collection("songbooks").get(),
    listAllUsers(),
  ]);

  const deleteSlugs = new Set(deleteProjects.map((p) => p.id));
  const deleteScores = scoresSnap.docs.filter((s) =>
    deleteSlugs.has(s.get("projectId") as string),
  );
  const deleteSongbooks = songbooksSnap.docs.filter((s) =>
    deleteSlugs.has(s.get("projectId") as string),
  );
  const deleteUsers = allUsers.filter((u) => u.uid !== CADERNIN_UID);

  console.log(`${execute ? "EXECUTE" : "DRY RUN"} against ${FIREBASE_PROJECT_ID}\n`);
  console.log(`Projects to delete: ${deleteProjects.length}/${projectsSnap.size}`);
  for (const p of deleteProjects) {
    const memberIds = (p.get("memberIds") as string[] | undefined) ?? [];
    const scoreCount = deleteScores.filter((s) => s.get("projectId") === p.id).length;
    const songbookCount = deleteSongbooks.filter((s) => s.get("projectId") === p.id).length;
    console.log(
      `  - ${p.id} (members: ${memberIds.length}, scores: ${scoreCount}, songbooks: ${songbookCount})`,
    );
  }
  console.log(`\nUsers to delete: ${deleteUsers.length}/${allUsers.length}`);
  for (const u of deleteUsers) {
    console.log(`  - ${u.uid} (${u.email ?? u.displayName ?? "no email/name"})`);
  }

  if (!execute) {
    console.log("\nDry run only — rerun with --yes to execute.");
    return;
  }

  console.log("\nDeleting Firestore data...");
  for (const score of deleteScores) {
    await db.recursiveDelete(score.ref);
  }
  for (const songbook of deleteSongbooks) {
    await db.recursiveDelete(songbook.ref);
  }
  for (const project of deleteProjects) {
    await db.recursiveDelete(project.ref);
  }

  console.log("Deleting Storage objects...");
  for (const project of deleteProjects) {
    await bucket.deleteFiles({ prefix: `projects/${project.id}/` });
  }
  for (const user of deleteUsers) {
    await bucket.deleteFiles({ prefix: `avatars/${user.uid}` });
  }

  console.log("Deleting Auth users...");
  for (let i = 0; i < deleteUsers.length; i += 1000) {
    const chunk = deleteUsers.slice(i, i + 1000).map((u) => u.uid);
    const result = await getAuth().deleteUsers(chunk);
    console.log(`  deleted ${result.successCount}/${chunk.length} (${result.failureCount} failures)`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
