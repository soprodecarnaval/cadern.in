// Runs against the auth and firestore emulators: `npm run test:functions`
// from the repo root.
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import {
  findUserForInviteHandler,
} from "../src/findUserForInvite";
import { resetAuth, resetFirestore, useEmulators } from "./emulator";

const PROJECT = "acervo";

useEmulators();

beforeEach(async () => {
  await resetAuth();
  await resetFirestore();
  const project = getFirestore().collection("projects").doc(PROJECT);
  await project.set({ title: "Acervo", deletedAt: null });
  for (const [uid, role] of [["admin", "admin"], ["editor", "editor"]]) {
    await project.collection("members").doc(uid).set({ uid, role });
  }
});

const createUser = (uid: string, displayName?: string) =>
  getAuth().createUser({ uid, displayName, email: `${uid}@x.com` });

const find = (caller: string | undefined, email: string) =>
  findUserForInviteHandler(caller, { projectId: PROJECT, email });

describe("findUserForInvite", () => {
  it("finds an existing account by email with surrounding spaces", async () => {
    await createUser("ana", "Ana Souza");
    await expect(find("admin", "  ana@x.com ")).resolves.toEqual({
      status: "found",
      uid: "ana",
      displayName: "Ana Souza",
    });
  });

  it("reports an unknown email without returning account details", async () => {
    await expect(find("admin", "unknown@x.com")).resolves.toEqual({
      status: "not-found",
    });
  });

  it("rejects callers who are not admins of the project", async () => {
    await createUser("ana", "Ana");
    await expect(find("editor", "ana@x.com")).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(find("stranger", "ana@x.com")).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(find(undefined, "ana@x.com")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects a deleted project", async () => {
    await getFirestore().collection("projects").doc(PROJECT)
      .update({ deletedAt: new Date() });
    await expect(find("admin", "x@x.com")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects malformed requests", async () => {
    await expect(find("admin", "not-an-email")).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});
