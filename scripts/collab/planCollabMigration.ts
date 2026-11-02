import { getFirestore } from "firebase-admin/firestore";
import { CADERNIN_UID, FIRESTORE_DATABASE_ID } from "../lib/env";
import { initAdminApp } from "../lib/firebaseAdmin";
import { assertCatalog, loadCollabCatalog, reportAssignments } from "./lib/collabCatalog";
import { planProjectMembers } from "./lib/collabProjects";
import { planSongbooks, reportSongbooks } from "./lib/collabSongbooks";
import { planReviewedScores, reportReviewedScores } from "./lib/collabReview";

async function main() {
  if (process.argv.length > 2) throw new Error("Usage: tsx --env-file=<env file> scripts/collab/planCollabMigration.ts (read-only)");
  initAdminApp();
  const catalog = await loadCollabCatalog(getFirestore(FIRESTORE_DATABASE_ID));
  reportAssignments(catalog.assignments);
  reportReviewedScores(planReviewedScores(catalog));
  const books = planSongbooks(catalog);
  reportSongbooks(books);
  assertCatalog([...new Set([...planProjectMembers(catalog, CADERNIN_UID).errors, ...books.errors])]);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
