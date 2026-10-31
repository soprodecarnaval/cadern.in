// Runs against the firestore emulator: `npm run test:functions` from the repo
// root. Calls the trigger handlers directly with before/after data.
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import {
  onProjectWritten,
  onScoreWritten,
  onSongbookWritten,
  rebuildPublished,
} from "../src/publishedScores";
import { resetFirestore, useEmulators } from "./emulator";

useEmulators();

const db = () => getFirestore();

/** Projects A and B, scores a1, a2 (in A) and b1 (in B). */
beforeEach(async () => {
  await resetFirestore();
  for (const id of ["A", "B"]) {
    await db().collection("projects").doc(id).set({ deletedAt: null });
  }
  for (const [id, projectId] of [["a1", "A"], ["a2", "A"], ["b1", "B"]]) {
    await db().collection("scores").doc(id).set({
      projectId,
      latestRevisionId: `${id}-r2`,
      published: null,
      deletedAt: null,
    });
  }
});

/**
 * Writes a songbook and its current revision, as the client would.
 * @param {string} id The songbook id.
 * @param {object} data Container fields and the revision's pins.
 * @return {Promise<object>} The container data written.
 */
async function songbook(
  id: string,
  data: {
    projectId?: string;
    pins: Record<string, string>;
    isPublished?: boolean;
    revision?: string;
    createdAt?: number;
  },
) {
  const revision = data.revision ?? "r1";
  const ref = db().collection("songbooks").doc(id);
  await ref.collection("songbookRevisions").doc(revision).set({
    pins: data.pins,
    createdAt: Timestamp.fromMillis(data.createdAt ?? 1000),
  });
  const container = {
    projectId: data.projectId ?? "A",
    currentRevisionId: revision,
    isPublished: data.isPublished ?? true,
    deletedAt: null,
  };
  await ref.set(container);
  return container;
}

const published = async (scoreId: string) =>
  (await db().collection("scores").doc(scoreId).get()).get("published");

describe("onSongbookWritten", () => {
  it("publishes pinned versions, also of other projects' scores", async () => {
    const after = await songbook("A~sb", {
      pins: { a1: "a1-r1", b1: "b1-r2" },
    });
    await onSongbookWritten(db(), "A~sb", undefined, after);
    expect(await published("a1")).toEqual({
      revisionId: "a1-r1",
      songbookIds: ["A~sb"],
    });
    expect(await published("b1")).toEqual({
      revisionId: "b1-r2",
      songbookIds: ["A~sb"],
    });
    expect(await published("a2")).toBeNull();
  });

  it("unpublishes when the songbook is unpublished or deleted", async () => {
    const before = await songbook("A~sb", { pins: { a1: "a1-r1" } });
    await onSongbookWritten(db(), "A~sb", undefined, before);

    const unpublished = { ...before, isPublished: false };
    await db().collection("songbooks").doc("A~sb").set(unpublished);
    await onSongbookWritten(db(), "A~sb", before, unpublished);
    expect(await published("a1")).toBeNull();

    await db().collection("songbooks").doc("A~sb").set(before);
    await onSongbookWritten(db(), "A~sb", unpublished, before);
    expect(await published("a1")).not.toBeNull();

    const deleted = { ...before, deletedAt: Timestamp.now() };
    await db().collection("songbooks").doc("A~sb").set(deleted);
    await onSongbookWritten(db(), "A~sb", before, deleted);
    expect(await published("a1")).toBeNull();
  });

  it("follows a re-pin and drops scores the new revision leaves out",
    async () => {
      const before = await songbook("A~sb", {
        pins: { a1: "a1-r1", a2: "a2-r1" },
      });
      await onSongbookWritten(db(), "A~sb", undefined, before);
      const after = await songbook("A~sb", {
        pins: { a1: "a1-r2" },
        revision: "r2",
        createdAt: 2000,
      });
      await onSongbookWritten(db(), "A~sb", before, after);
      expect((await published("a1")).revisionId).toBe("a1-r2");
      expect(await published("a2")).toBeNull();
    });

  it("lets the most recent songbook revision name the version", async () => {
    const older = await songbook("A~old", {
      pins: { a1: "a1-r1" }, createdAt: 1000,
    });
    await onSongbookWritten(db(), "A~old", undefined, older);
    const newer = await songbook("B~new", {
      projectId: "B", pins: { a1: "a1-r2" }, createdAt: 2000,
    });
    await onSongbookWritten(db(), "B~new", undefined, newer);
    expect(await published("a1")).toEqual({
      revisionId: "a1-r2",
      songbookIds: ["A~old", "B~new"],
    });
  });

  it("ignores writes that change nothing it depends on", async () => {
    const data = await songbook("A~sb", { pins: { a1: "a1-r1" } });
    const changes = await onSongbookWritten(db(), "A~sb", data,
      { ...data, title: "Outro" });
    expect(changes).toEqual([]);
    expect(await published("a1")).toBeNull();
  });
});

describe("onScoreWritten and onProjectWritten", () => {
  it("unpublishes a deleted score and republishes it on restore",
    async () => {
      const sb = await songbook("A~sb", { pins: { a1: "a1-r1" } });
      await onSongbookWritten(db(), "A~sb", undefined, sb);
      const score = db().collection("scores").doc("a1");
      const before = (await score.get()).data();

      await score.update({ deletedAt: Timestamp.now() });
      await onScoreWritten(db(), "a1", before, (await score.get()).data());
      expect(await published("a1")).toBeNull();

      const deleted = (await score.get()).data();
      await score.update({ deletedAt: null });
      await onScoreWritten(db(), "a1", deleted, (await score.get()).data());
      expect(await published("a1")).toEqual({
        revisionId: "a1-r1",
        songbookIds: ["A~sb"],
      });
    });

  it("unpublishes a deleted project's scores and its songbooks' pins",
    async () => {
      const sb = await songbook("A~sb", { pins: { a1: "a1-r1", b1: "b1-r1" } });
      await onSongbookWritten(db(), "A~sb", undefined, sb);
      await db().collection("projects").doc("A")
        .update({ deletedAt: Timestamp.now() });
      await onProjectWritten(db(), "A", { deletedAt: null },
        { deletedAt: Timestamp.now() });
      expect(await published("a1")).toBeNull();
      // b1 belongs to B, but its only songbook was in A.
      expect(await published("b1")).toBeNull();

      await db().collection("projects").doc("A").update({ deletedAt: null });
      await onProjectWritten(db(), "A", { deletedAt: Timestamp.now() },
        { deletedAt: null });
      expect(await published("a1")).not.toBeNull();
      expect(await published("b1")).not.toBeNull();
    });
});

describe("rebuildPublished", () => {
  it("computes every marker from scratch and can dry-run", async () => {
    await songbook("A~sb", { pins: { a1: "a1-r1", b1: "b1-r1" } });
    const dry = await rebuildPublished(db(), true);
    expect(dry.map((c) => c.scoreId).sort()).toEqual(["a1", "b1"]);
    expect(await published("a1")).toBeNull();
    await rebuildPublished(db(), false);
    expect((await published("b1")).revisionId).toBe("b1-r1");
  });
});
