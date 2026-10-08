// Runs against the auth and firestore emulators: `npm run test:functions`
// from the repo root.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  findUserForInviteHandler,
  normalizeName,
} from "../src/findUserForInvite";

const PROJECT_ID = "demo-cadernin";
const PROJECT = "acervo";

beforeAll(() => {
  initializeApp({ projectId: PROJECT_ID });
});

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

beforeEach(async () => {
  await reset(process.env.FIREBASE_AUTH_EMULATOR_HOST, "/accounts");
  await reset(
    process.env.FIRESTORE_EMULATOR_HOST,
    "/databases/(default)/documents",
  );
  const project = getFirestore().collection("projects").doc(PROJECT);
  await project.set({ title: "Acervo", deletedAt: null });
  for (const [uid, role] of [["admin", "admin"], ["editor", "editor"]]) {
    await project.collection("members").doc(uid).set({ uid, role });
  }
});

const createUser = (uid: string, displayName?: string) =>
  getAuth().createUser({ uid, displayName, email: `${uid}@x.com` });

const find = (caller: string | undefined, displayName: string) =>
  findUserForInviteHandler(caller, { projectId: PROJECT, displayName });

describe("findUserForInvite", () => {
  it("finds a user by display name, ignoring case and spaces", async () => {
    await createUser("ana", "Ana Souza");
    await expect(find("admin", "  ana souza ")).resolves.toEqual({
      status: "found",
      uid: "ana",
      displayName: "Ana Souza",
    });
  });

  it("reports nobody and ambiguity without naming anyone", async () => {
    await createUser("ana1", "Ana");
    await createUser("ana2", "ana");
    await expect(find("admin", "Bia")).resolves.toEqual({
      status: "not-found",
    });
    await expect(find("admin", "Ana")).resolves.toEqual({
      status: "ambiguous",
    });
  });

  it("rejects callers who are not admins of the project", async () => {
    await createUser("ana", "Ana");
    await expect(find("editor", "Ana")).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(find("stranger", "Ana")).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(find(undefined, "Ana")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects a deleted project", async () => {
    await getFirestore().collection("projects").doc(PROJECT)
      .update({ deletedAt: new Date() });
    await expect(find("admin", "x")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects malformed requests", async () => {
    await expect(find("admin", " ")).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});

describe("normalizeName", () => {
  it("unifies composed and decomposed accents", () => {
    expect(normalizeName("José")).toBe(normalizeName("José"));
  });
});
