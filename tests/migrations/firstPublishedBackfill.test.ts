import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import migration from "../../scripts/migrations/202611101500_first_published_backfill";

const projectId = "demo-cadernin";
const app = initializeApp({ projectId });
let db: Firestore;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Run npm run test:migrations; cloud access is forbidden");
  }
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
});

async function seedSongbook(
  id: string,
  revisions: { id: string; pins: Record<string, string>; createdAt: number }[],
  { projectId: owner = "A", currentRevisionId }: {
    projectId?: string; currentRevisionId: string;
  },
) {
  for (const revision of revisions) {
    await db.doc(`songbooks/${id}/songbookRevisions/${revision.id}`).set({
      pins: revision.pins,
      createdAt: Timestamp.fromMillis(revision.createdAt),
    });
  }
  await db.doc(`songbooks/${id}`).set({
    projectId: owner, currentRevisionId, isPublished: true, deletedAt: null,
  });
}

async function seedScore(id: string, published: { songbookIds: string[] } | null) {
  await db.doc(`scores/${id}`).set({ projectId: "A", published, deletedAt: null });
}

async function up(dryRun = false) {
  await migration.up({ db, bucket: {} as never, dryRun });
}
async function down(dryRun = false) {
  await migration.down({ db, bucket: {} as never, dryRun });
}

async function firstPublished(id: string) {
  return (await db.doc(`scores/${id}`).get()).get("firstPublished");
}

describe("202611101500_first_published_backfill", () => {
  it("credits the songbook whose history pins the score earliest", async () => {
    // sbA's revision 1 (t=100) already pinned s1; its current revision (t=300)
    // still does. sbB only started pinning s1 later (t=200), after sbA.
    await seedSongbook("A~sbA", [
      { id: "r1", pins: { s1: "s1-r1" }, createdAt: 100 },
      { id: "r2", pins: { s1: "s1-r1" }, createdAt: 300 },
    ], { projectId: "A", currentRevisionId: "r2" });
    await seedSongbook("B~sbB", [
      { id: "r1", pins: { s1: "s1-r1" }, createdAt: 200 },
    ], { projectId: "B", currentRevisionId: "r1" });
    await seedScore("s1", { songbookIds: ["A~sbA", "B~sbB"] });

    await up();
    expect(await firstPublished("s1")).toEqual({
      songbookId: "A~sbA",
      projectId: "A",
      publishedAt: Timestamp.fromMillis(100),
    });
  });

  it("leaves scores that aren't currently published as null", async () => {
    await seedScore("s2", null);
    await up();
    expect(await firstPublished("s2")).toBeFalsy();
  });

  it("never overwrites an already-set firstPublished, and dry run writes nothing", async () => {
    await seedSongbook("A~sbA", [
      { id: "r1", pins: { s1: "s1-r1" }, createdAt: 100 },
    ], { projectId: "A", currentRevisionId: "r1" });
    await seedScore("s1", { songbookIds: ["A~sbA"] });
    await db.doc("scores/s1").update({
      firstPublished: {
        songbookId: "preexisting", projectId: "Z",
        publishedAt: Timestamp.fromMillis(1),
      },
    });

    await up(true); // dry run: must not touch anything.
    expect((await firstPublished("s1")).songbookId).toBe("preexisting");

    await up(false); // real run: write-once guard must still hold.
    expect((await firstPublished("s1")).songbookId).toBe("preexisting");
  });

  it("down() clears only what was backfilled", async () => {
    await seedSongbook("A~sbA", [
      { id: "r1", pins: { s1: "s1-r1" }, createdAt: 100 },
    ], { projectId: "A", currentRevisionId: "r1" });
    await seedScore("s1", { songbookIds: ["A~sbA"] });
    await up();
    expect(await firstPublished("s1")).toBeTruthy();

    await down(true); // dry run leaves it in place.
    expect(await firstPublished("s1")).toBeTruthy();

    await down(false);
    expect(await firstPublished("s1")).toBeFalsy();
  });
});
