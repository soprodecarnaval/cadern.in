// Runs against the firestore emulator: `npm run test:functions` from the repo
// root.
import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { swapSongbookEntryHandler } from "../src/swapSongbookEntry";
import { resetFirestore, useEmulators } from "./emulator";

useEmulators();

const db = () => getFirestore();
const SB = "gar~sb";

beforeEach(async () => {
  await resetFirestore();
  const project = db().collection("projects").doc("gar");
  await project.set({ deletedAt: null });
  await project.collection("members").doc("ed").set({ role: "editor" });
  await project.collection("members").doc("rev").set({ role: "reviewer" });
  await db().collection("scores").doc("cbh-eva").set({
    projectId: "cbh", latestRevisionId: "e2", deletedAt: null,
  });
  await db().collection("scores").doc("gar-eva").set({
    projectId: "gar",
    latestRevisionId: "f1",
    title: "Eva",
    forkedFrom: { scoreId: "cbh-eva", revisionId: "e1", projectId: "cbh" },
    deletedAt: null,
  });
  await db().collection("scores").doc("gar-outra").set({
    projectId: "gar", latestRevisionId: "o1", deletedAt: null,
  });
  const songbook = db().collection("songbooks").doc(SB);
  await songbook.set({
    projectId: "gar", currentRevisionId: "r1", deletedAt: null,
  });
  await songbook.collection("songbookRevisions").doc("r1").set({
    entries: [
      { type: "section", title: "S", order: 0 },
      { type: "score", scoreId: "cbh-eva", order: 1, index: 7 },
    ],
    pins: { "cbh-eva": "e1" },
    covers: {},
    revisionNumber: 1,
    prevRevisionId: null,
  });
});

const swap = (uid: string | undefined, forkId = "gar-eva") =>
  swapSongbookEntryHandler(uid, { songbookId: SB, scoreId: "cbh-eva", forkId });

describe("swapSongbookEntryToFork", () => {
  it("swaps in a new version, keeping place and number", async () => {
    const { revisionId } = await swap("ed");
    const songbook = await db().collection("songbooks").doc(SB).get();
    expect(songbook.get("currentRevisionId")).toBe(revisionId);
    const revision = await songbook.ref
      .collection("songbookRevisions").doc(revisionId).get();
    expect(revision.get("entries")).toEqual([
      { type: "section", title: "S", order: 0 },
      { type: "score", scoreId: "gar-eva", order: 1, index: 7 },
    ]);
    expect(revision.get("pins")).toEqual({ "gar-eva": "f1" });
    expect(revision.get("revisionNumber")).toBe(2);
    expect(revision.get("prevRevisionId")).toBe("r1");
    expect(revision.get("note")).toBe("troca: Eva → derivação");
  });

  it("rejects anyone below editor", async () => {
    await expect(swap(undefined)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(swap("rev")).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(swap("stranger")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects a score that isn't a fork of the entry's", async () => {
    await expect(swap("ed", "gar-outra")).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rejects a fork already in the songbook", async () => {
    await db().collection("songbooks").doc(SB)
      .collection("songbookRevisions").doc("r1")
      .update({ "pins.gar-eva": "f1" });
    await expect(swap("ed")).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});
