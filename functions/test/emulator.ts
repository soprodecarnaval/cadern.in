import { initializeApp } from "firebase-admin/app";
import { beforeAll } from "vitest";

export const PROJECT_ID = "demo-cadernin";

/** Initializes the Admin SDK against the emulators, once per test file. */
export function useEmulators(): void {
  beforeAll(() => {
    initializeApp({ projectId: PROJECT_ID });
  });
}

/**
 * Wipes an emulator's data through its REST endpoint.
 * @param {string | undefined} host The emulator host from the environment.
 * @param {string} path The emulator-specific reset path.
 */
async function reset(host: string | undefined, path: string): Promise<void> {
  if (!host) {
    throw new Error("Run through `npm run test:functions` (emulators).");
  }
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}${path}`, {
    method: "DELETE",
  });
}

export const resetFirestore = () =>
  reset(process.env.FIRESTORE_EMULATOR_HOST, "/databases/(default)/documents");

export const resetAuth = () =>
  reset(process.env.FIREBASE_AUTH_EMULATOR_HOST, "/accounts");
