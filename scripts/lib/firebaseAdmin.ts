import { readFileSync } from "node:fs";
import { applicationDefault, initializeApp, type App } from "firebase-admin/app";
import { z } from "zod";
import { FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET } from "./env";

const zServiceAccount = z.object({ project_id: z.string() });

/**
 * Initializes the Admin SDK against `SCRIPTS_FIREBASE_PROJECT_ID`, refusing to
 * start if the credentials or bucket belong to another project.
 *
 * Without an explicit `projectId` the SDK takes the project from the
 * credentials, so a production service account paired with a staging bucket
 * would silently read and write production Firestore.
 */
export function initAdminApp(): App {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    // Only service-account keys name a project; user credentials from
    // `gcloud auth application-default login` don't, and need no check.
    const parsed = zServiceAccount.safeParse(
      JSON.parse(readFileSync(credentialsPath, "utf8")),
    );
    if (parsed.success && parsed.data.project_id !== FIREBASE_PROJECT_ID) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS (${credentialsPath}) is for project ` +
          `"${parsed.data.project_id}", but SCRIPTS_FIREBASE_PROJECT_ID is ` +
          `"${FIREBASE_PROJECT_ID}".`,
      );
    }
  }

  if (!FIREBASE_STORAGE_BUCKET.startsWith(`${FIREBASE_PROJECT_ID}.`)) {
    throw new Error(
      `SCRIPTS_FIREBASE_STORAGE_BUCKET "${FIREBASE_STORAGE_BUCKET}" does not ` +
        `belong to project "${FIREBASE_PROJECT_ID}".`,
    );
  }

  console.log(`Firebase project: ${FIREBASE_PROJECT_ID}\n`);
  return initializeApp({
    credential: applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
  });
}
