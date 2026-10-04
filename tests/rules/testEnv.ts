import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, setLogLevel, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach } from "vitest";

export const PROJECT_ID = "demo-cadernin";

export const OWNER = "owner-uid";
export const ADMIN = "admin-uid";
export const EDITOR = "editor-uid";
export const REVIEWER = "reviewer-uid";
export const OUTSIDER = "outsider-uid";

export const PROJECT = "acervo";
export const SCORE = "acervo-olha-pro-ceu";

/** Registers the emulator lifecycle hooks for the calling test file. */
export function useTestEnv(): () => RulesTestEnvironment {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Denied writes are the point of half the tests; don't log each one.
    setLogLevel("silent");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readFileSync("firestore.rules", "utf8") },
      storage: { rules: readFileSync("storage.rules", "utf8") },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  return () => testEnv;
}

/** A project with one member per role, and one score in it. */
export async function seedProject(testEnv: RulesTestEnvironment) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, "projects", PROJECT), {
      title: "Acervo",
      slug: PROJECT,
      members: {
        [OWNER]: "owner",
        [ADMIN]: "admin",
        [EDITOR]: "editor",
        [REVIEWER]: "reviewer",
      },
      memberIds: [OWNER, ADMIN, EDITOR, REVIEWER],
    });
    await setDoc(doc(db, "scores", SCORE), {
      title: "Olha pro céu",
      projectId: PROJECT,
      uploadedBy: EDITOR,
      latestRevisionId: "1",
      deletedAt: null,
    });
  });
}

export function firestoreAs(
  testEnv: RulesTestEnvironment,
  uid: string | null,
): Firestore {
  const ctx =
    uid === null
      ? testEnv.unauthenticatedContext()
      : testEnv.authenticatedContext(uid);
  return ctx.firestore() as unknown as Firestore;
}
