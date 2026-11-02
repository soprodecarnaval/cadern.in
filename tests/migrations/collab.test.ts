import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCollabCatalog, catalogJournal } from "../../scripts/lib/collabCatalog";
import { migrateProjects } from "../../scripts/lib/collabProjects";
import { migrateSongbooks, planSongbooks } from "../../scripts/lib/collabSongbooks";
import { DEFERRED_STYLE_SCORES } from "../../scripts/lib/collabStyles";
import { REVIEWED_SCORES } from "../../scripts/lib/collabReview";

vi.mock("../../scripts/lib/authDisplayNames", () => ({
  authDisplayNames: async (uids: string[]) => new Map(uids.map((uid) => [uid, `Name ${uid}`])),
}));

const OWNER = "cadernin";
const projectId = "demo-cadernin";
const app = initializeApp({ projectId });
let db: Firestore;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Run npm run test:migrations; cloud access is forbidden");
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
});

async function seedProject(id: string, owner = OWNER) {
  await db.collection("projects").doc(id).set({
    title: id, slug: id, createdAt: Timestamp.fromMillis(1), deletedAt: null,
    members: { [owner]: "owner" }, memberIds: [owner],
  });
  await db.doc(`projects/${id}/members/${owner}`).set({
    uid: owner, role: "owner", displayName: "CADERNIN", addedBy: owner, addedAt: Timestamp.fromMillis(1),
  });
}

async function seedScore(id: string, project: string, title = id, tags = ["samba"]) {
  const file = { path: `scores/${id}/1/test`, url: `https://example.com/${id}` };
  await db.doc(`scores/${id}`).set({
    projectId: project, uploadedBy: OWNER, title, composer: "", sub: "", tags,
    latestRevisionId: "1", createdAt: Timestamp.fromMillis(1), deletedAt: null,
    cachedMetadata: { title, composer: "", sub: "", tags }, published: null,
  });
  const revision = {
    revisionNumber: 1, uploadedBy: OWNER, uploadedAt: Timestamp.fromMillis(1),
    mscz: file, metajson: file, midi: file, parts: [], notes: "", metadata: { title, composer: "", sub: "", tags },
  };
  await db.doc(`scores/${id}/revisions/1`).set({ ...revision, isLatest: true });
  await db.doc(`scores/${id}/scoreRevisions/1`).set(revision);
}

async function m6(dryRun = false) { await migrateProjects(db, await loadCollabCatalog(db), OWNER, dryRun); }
async function m7(dryRun = false) { await migrateSongbooks(db, await loadCollabCatalog(db), OWNER, dryRun); }

async function seedReviewedScore(id: string, seeded = new Set<string>()) {
  if (seeded.has(id)) return;
  seeded.add(id);
  const row = REVIEWED_SCORES.get(id)!;
  await seedProject(row.source);
  await seedScore(id, row.source, row.title, row.originalTags);
  if (row.predecessor) await seedReviewedScore(row.predecessor.scoreId, seeded);
}

describe("M6/M7 against Firestore", () => {
  it("moves containers, preserves versions/files, archives sources and publishes separate yearly books", async () => {
    await seedProject("carnaval-bh-2025");
    await seedProject("carnaval-bh-2026");
    await seedProject("crack-carnaval-bh-2026");
    await seedScore("original-score-id", "carnaval-bh-2025", "Zebra");
    await seedScore("next-score", "carnaval-bh-2026", "Água");
    await seedScore("crack-score", "crack-carnaval-bh-2026");
    const revisionBefore = (await db.doc("scores/original-score-id/scoreRevisions/1").get()).data();
    await m6();
    expect((await db.doc("scores/original-score-id").get()).get("projectId")).toBe("carnaval-bh");
    expect((await db.doc("scores/original-score-id/scoreRevisions/1").get()).data()).toEqual(revisionBefore);
    expect((await db.doc("projects/carnaval-bh-2025").get()).get("deletedAt")).toBeInstanceOf(Timestamp);
    expect((await db.doc(`projects/carnaval-bh-2025/members/${OWNER}`).get()).exists).toBe(true);
    expect((await db.doc(`projects/carnaval-bh/members/${OWNER}`).get()).get("role")).toBe("owner");
    await m7();
    expect((await db.doc("songbooks/carnaval-bh~2025/songbookRevisions/1").get()).get("pins")).toEqual({ "original-score-id": "1" });
    expect((await db.doc("songbooks/carnaval-bh~2026/songbookRevisions/1").get()).get("pins")).toEqual({ "next-score": "1" });
    expect((await db.doc("songbooks/carnaval-bh~crack-2026").get()).get("title")).toBe("carnaval-bh/crack-2026");
    expect((await db.doc("scores/original-score-id").get()).get("published")).toEqual({ revisionId: "1", songbookIds: ["carnaval-bh~2025"] });
  });

  it("preserves independent groups and strongest membership roles, including on retries", async () => {
    await seedProject("blocae");
    await seedScore("blocae-score", "blocae");
    await db.doc("projects/blocae/members/editor").set({ uid: "editor", role: "editor", displayName: "Editor", addedBy: OWNER, addedAt: Timestamp.fromMillis(1) });
    await m6();
    await m7();
    expect((await db.doc("projects/blocae").get()).get("deletedAt")).toBeNull();
    expect((await db.doc("projects/blocae/members/editor").get()).get("role")).toBe("editor");
    await db.doc("songbooks/blocae~acervo").update({ title: "Human edit" });
    const bookBefore = (await db.doc("songbooks/blocae~acervo").get()).data();
    const revisionBefore = (await db.doc("songbooks/blocae~acervo/songbookRevisions/1").get()).data();
    await m6();
    await m7();
    expect((await db.doc("songbooks/blocae~acervo").get()).data()).toEqual(bookBefore);
    expect((await db.doc("songbooks/blocae~acervo/songbookRevisions/1").get()).data()).toEqual(revisionBefore);
  });

  it("resumes from a partial M6 move using the saved original year", async () => {
    await seedProject("garota-2025");
    await seedScore("a", "garota-2025");
    await seedScore("b", "garota-2025");
    const catalog = await loadCollabCatalog(db);
    await catalogJournal(db).collection("projects").doc("garota-2025").set(catalog.assignments[0]);
    await seedProject("garota");
    await db.doc("scores/a").update({ projectId: "garota" });
    await m6();
    await m7();
    expect((await db.doc("songbooks/garota~2025/songbookRevisions/1").get()).get("pins")).toEqual({ a: "1", b: "1" });
  });

  it("keeps dry runs read-only and reports both years before M6", async () => {
    await seedProject("na-tora-2025");
    await seedProject("na-tora-2026");
    await seedScore("a", "na-tora-2025");
    await seedScore("b", "na-tora-2026");
    await m6(true);
    await m7(true);
    expect((await db.collection("songbooks").get()).empty).toBe(true);
    expect((await catalogJournal(db).collection("projects").get()).empty).toBe(true);
    expect((await db.doc("scores/a").get()).get("projectId")).toBe("na-tora-2025");
  });

  it("reports unknown styles and refuses unreviewed homepage omissions", async () => {
    await seedProject("carnaval-bh-2026");
    await seedScore("unknown-style", "carnaval-bh-2026", "Unknown", ["unrecognized"]);
    const plan = planSongbooks(await loadCollabCatalog(db));
    expect(plan.omissions).toEqual(["unknown-style"]);
    await m6();
    await expect(m7()).rejects.toThrow("Unreviewed homepage omission");
    expect((await db.collection("songbooks").get()).empty).toBe(true);
  });

  it("refuses unmapped projects and ownership conflicts before writing a journal", async () => {
    await seedProject("unknown");
    await seedScore("x", "unknown");
    await expect(m6()).rejects.toThrow("Unmapped project");
    expect((await catalogJournal(db).collection("projects").get()).empty).toBe(true);
    await db.doc("projects/unknown").update({ deletedAt: Timestamp.now() });
    await seedProject("besourinhos-2024", "someone-else");
    await expect(m6()).rejects.toThrow("owned solely by CADERNIN");
    expect((await catalogJournal(db).collection("projects").get()).empty).toBe(true);
  });

  it("pins exact latest versions with fixed numbers and skips deleted scores", async () => {
    await seedProject("garota-2026");
    await seedScore("z", "garota-2026", "Zebra", []);
    await seedScore("a", "garota-2026", "Água", []);
    await seedScore("deleted", "garota-2026");
    await db.doc("scores/deleted").update({ deletedAt: Timestamp.now() });
    const version = (await db.doc("scores/a/scoreRevisions/1").get()).data()!;
    await db.doc("scores/a/scoreRevisions/title-timestamp-abcd").set({ ...version, revisionNumber: 2 });
    await db.doc("scores/a").update({ latestRevisionId: "title-timestamp-abcd" });
    await m6();
    await m7();
    const revision = await db.doc("songbooks/garota~2026/songbookRevisions/1").get();
    expect(revision.get("pins")).toEqual({ a: "title-timestamp-abcd", z: "1" });
    expect(revision.get("entries")).toEqual([
      { type: "section", title: "Sem estilo", order: 0 },
      { type: "score", scoreId: "a", order: 1, index: 1 },
      { type: "score", scoreId: "z", order: 2, index: 2 },
    ]);
  });

  it("merges shared memberships without demotion and cancels archived-source invitations", async () => {
    await seedProject("garota-2025");
    await seedProject("garota-2026");
    await seedScore("a", "garota-2025");
    for (const [project, role] of [["garota-2025", "reviewer"], ["garota-2026", "editor"]]) {
      await db.doc(`projects/${project}/members/member`).set({
        uid: "member", role, displayName: "Member", addedBy: OWNER, addedAt: Timestamp.fromMillis(1),
      });
    }
    await db.doc("projects/garota-2025/invitations/invitee").set({ accepted: null, deletedAt: null });
    await m6();
    expect((await db.doc("projects/garota/members/member").get()).get("role")).toBe("editor");
    expect((await db.doc("projects/garota-2025/invitations/invitee").get()).get("deletedAt")).toBeInstanceOf(Timestamp);
  });

  it("resumes a partial M7 without rewriting the songbooks already created", async () => {
    await seedProject("garota-2025");
    await seedProject("garota-2026");
    await seedScore("a", "garota-2025");
    await seedScore("b", "garota-2026");
    await m6();
    const catalog = await loadCollabCatalog(db);
    await migrateSongbooks(db, { ...catalog, assignments: catalog.assignments.slice(0, 1), baseline: new Set(["a"]) }, OWNER, false);
    await db.doc("songbooks/garota~2025").update({ title: "Edited before retry" });
    const before = (await db.doc("songbooks/garota~2025/songbookRevisions/1").get()).data();
    await m7();
    expect((await db.doc("songbooks/garota~2025").get()).get("title")).toBe("Edited before retry");
    expect((await db.doc("songbooks/garota~2025/songbookRevisions/1").get()).data()).toEqual(before);
    expect((await db.doc("songbooks/garota~2026/songbookRevisions/1").get()).get("pins")).toEqual({ b: "1" });
  });

  it("refuses unmanaged songbook collisions before moving scores", async () => {
    await seedProject("garota-2025");
    await seedProject("garota");
    await seedScore("a", "garota-2025");
    await db.doc("songbooks/garota~2025").set({
      title: "Existing book", projectId: "garota", slug: "2025", currentRevisionId: "1", isPublished: false,
      createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1), deletedAt: null,
    });
    await expect(m6()).rejects.toThrow("Unrelated songbook");
    expect((await db.doc("scores/a").get()).get("projectId")).toBe("garota-2025");
    expect((await catalogJournal(db).collection("projects").get()).empty).toBe(true);
  });

  it("archives madeira-pirata without deleting its scores, revisions or members", async () => {
    await seedProject("madeira-pirata");
    await seedScore("madeira-pirata-abre-alas", "madeira-pirata");
    const before = (await db.doc("scores/madeira-pirata-abre-alas").get()).data();
    await m6();
    await m7();
    expect((await db.doc("projects/madeira-pirata").get()).get("deletedAt")).toBeInstanceOf(Timestamp);
    expect((await db.doc("scores/madeira-pirata-abre-alas").get()).data()).toEqual(before);
    expect((await db.doc("scores/madeira-pirata-abre-alas/scoreRevisions/1").get()).exists).toBe(true);
    expect((await db.doc(`projects/madeira-pirata/members/${OWNER}`).get()).exists).toBe(true);
    expect((await db.collection("songbooks").get()).empty).toBe(true);
    await m6();
    await m7();
  });

  it("places Festa Junina under carnaval-bh/festa-junina-2024", async () => {
    await seedProject("festa-junina-2024");
    await seedScore("festa-score", "festa-junina-2024", "Festa", ["Festa Junina"]);
    await m6();
    await m7();
    expect((await db.doc("scores/festa-score").get()).get("projectId")).toBe("carnaval-bh");
    expect((await db.doc("songbooks/carnaval-bh~festa-junina-2024").get()).get("title")).toBe("carnaval-bh/festa-junina-2024");
    expect((await db.doc("songbooks/carnaval-bh~festa-junina-2024/songbookRevisions/1").get()).get("pins")).toEqual({ "festa-score": "1" });
  });

  it("uses inferred grouping and saves evidence without rewriting score/revision metadata", async () => {
    await seedProject("carnaval-bh-2023");
    await seedProject("blocae");
    await seedScore("old-score", "carnaval-bh-2023", "ANUNCIAÇÃO!", [""]);
    await seedScore("evidence", "blocae", "Anunciacao", ["forró"]);
    const before = (await db.doc("scores/old-score/scoreRevisions/1").get()).data();
    await m6();
    await m7();
    const version = await db.doc("songbooks/carnaval-bh~2023/songbookRevisions/1").get();
    expect(version.get("pins")).toEqual({ "old-score": "1" });
    expect(version.get("entries")[0].title).toBe("forró");
    expect((await catalogJournal(db).collection("styleInferences").doc("old-score").get()).data()).toMatchObject({ style: "forrós", sourceScoreIds: ["evidence"] });
    expect((await db.doc("scores/old-score").get()).get("tags")).toEqual([""]);
    expect((await db.doc("scores/old-score/scoreRevisions/1").get()).data()).toEqual(before);
  });

  it("journals reviewed deferrals while publishing the resolved scores", async () => {
    const deferred = DEFERRED_STYLE_SCORES[0];
    await seedProject("carnaval-bh-2020");
    await seedScore(deferred.scoreId, "carnaval-bh-2020", deferred.title, [""]);
    await seedScore("resolved", "carnaval-bh-2020", "Resolved", ["samba"]);
    await m6();
    await m7();
    expect((await db.doc(`scores/${deferred.scoreId}`).get()).get("projectId")).toBe("carnaval-bh");
    expect((await db.doc(`scores/${deferred.scoreId}`).get()).get("deletedAt")).toBeNull();
    expect((await db.doc("songbooks/carnaval-bh~2020/songbookRevisions/1").get()).get("pins")).toEqual({ resolved: "1" });
    expect((await catalogJournal(db).collection("deferredStyles").doc(deferred.scoreId).get()).data()).toMatchObject({ title: deferred.title, songbook: "carnaval-bh/2020" });
  });

  it("does not treat a new style conflict as an approved deferral", async () => {
    const deferred = DEFERRED_STYLE_SCORES[0];
    await seedProject("carnaval-bh-2020");
    await seedProject("blocae");
    await seedScore(deferred.scoreId, "carnaval-bh-2020", deferred.title, [""]);
    await seedScore("a", "blocae", deferred.title, ["samba"]);
    await seedScore("b", "blocae", deferred.title, ["axé"]);
    await m6();
    await expect(m7()).rejects.toThrow("Unreviewed homepage omission");
  });

  it("applies reviewed tags and historical lineage without changing titles, revisions or files", async () => {
    const id = "carnaval-bh-2025-prefixodoverao";
    await seedReviewedScore(id);
    const before = (await db.doc(`scores/${id}/scoreRevisions/1`).get()).data();
    const title = REVIEWED_SCORES.get(id)!.title;
    const catalog = await loadCollabCatalog(db);
    const preview = planSongbooks(catalog);
    await m6(true);
    expect((await catalogJournal(db).collection("scores").get()).empty).toBe(true);
    await m6();
    const score = await db.doc(`scores/${id}`).get();
    expect(score.get("title")).toBe(title);
    expect(score.get("forkedFrom")).toEqual(REVIEWED_SCORES.get(id)!.predecessor);
    expect(score.get("projectId")).toBe("carnaval-bh");
    expect((await db.doc(`scores/${id}/scoreRevisions/1`).get()).data()).toEqual(before);
    expect((await catalogJournal(db).collection("scores").doc(id).get()).get("before.forkedFrom")).toBeNull();
    await m7();
    for (const book of preview.books) {
      expect((await db.doc(`songbooks/${book.id}/songbookRevisions/1`).get()).get("pins")).toEqual(book.content.pins);
    }
  });

  it("links reviewed cross-project fallbacks to the moved source project and exact revision", async () => {
    const row = [...REVIEWED_SCORES.values()].find((row) => row.source === "na-tora-2025" && row.predecessor?.projectId === "carnaval-bh")!;
    await seedReviewedScore(row.scoreId);
    await m6();
    expect((await db.doc(`scores/${row.scoreId}`).get()).get("forkedFrom")).toEqual(row.predecessor);
    expect((await db.doc(`scores/${row.predecessor!.scoreId}`).get()).get("projectId")).toBe("carnaval-bh");
  });

  it("journals tag corrections, preserves immutable metadata and leaves later edits alone on retry", async () => {
    const id = "carnaval-bh-2026-vaporbarato";
    await seedReviewedScore(id);
    const before = (await db.doc(`scores/${id}/scoreRevisions/1`).get()).data();
    await m6();
    const score = await db.doc(`scores/${id}`).get();
    expect(score.get("metadataOverride.tags")).toEqual(["brazuka"]);
    expect(score.get("tags")).toEqual(["brazuka"]);
    expect((await db.doc(`scores/${id}/scoreRevisions/1`).get()).data()).toEqual(before);
    const journal = (await catalogJournal(db).collection("scores").doc(id).get()).data();
    await db.doc(`scores/${id}`).update({ "metadataOverride.tags": ["pagode"], tags: ["pagode"] });
    await m6();
    expect((await db.doc(`scores/${id}`).get()).get("metadataOverride.tags")).toEqual(["pagode"]);
    expect((await catalogJournal(db).collection("scores").doc(id).get()).data()).toEqual(journal);
    await db.doc(`scores/${id}`).update({ "metadataOverride.tags": [""], tags: [""] });
    await expect(m7()).rejects.toThrow("Unreviewed homepage omission");
  });

  it("soft-deletes exactly the rejected Garota duplicates and retains their revision data", async () => {
    for (const row of REVIEWED_SCORES.values()) if (row.excluded) await seedReviewedScore(row.scoreId);
    await seedProject("garota-2026");
    await seedScore("retained", "garota-2026", "Canonical copy", ["axé"]);
    await m6();
    await m7();
    for (const row of REVIEWED_SCORES.values()) if (row.excluded) {
      expect((await db.doc(`scores/${row.scoreId}`).get()).get("deletedAt")).toBeInstanceOf(Timestamp);
      expect((await db.doc(`scores/${row.scoreId}/scoreRevisions/1`).get()).exists).toBe(true);
      expect((await catalogJournal(db).collection("scores").doc(row.scoreId).get()).get("before.deletedAt")).toBeNull();
    }
    expect((await db.doc("scores/retained").get()).get("deletedAt")).toBeNull();
    expect((await db.doc("songbooks/garota~2026/songbookRevisions/1").get()).get("pins")).toEqual({ retained: "1" });
  });

  it("resumes interrupted score corrections from atomic journals before publishing", async () => {
    const rows = [...REVIEWED_SCORES.values()].filter((row) => row.source === "zagateile" && !row.predecessor).slice(0, 2);
    for (const row of rows) await seedReviewedScore(row.scoreId);
    const runTransaction = db.runTransaction.bind(db);
    const fault = vi.spyOn(db, "runTransaction").mockImplementationOnce(runTransaction).mockRejectedValueOnce(new Error("interrupted"));
    try { await expect(m6()).rejects.toThrow("interrupted"); }
    finally { fault.mockRestore(); }
    expect((await catalogJournal(db).collection("scores").get()).size).toBe(1);
    await expect(m7()).rejects.toThrow("M6 has not finished applying reviewed score decisions");
    expect((await db.collection("songbooks").get()).empty).toBe(true);
    await m6();
    expect((await catalogJournal(db).collection("scores").get()).size).toBe(2);
    for (const row of rows) expect((await db.doc(`scores/${row.scoreId}`).get()).get("metadataOverride.tags")).toEqual(["axé"]);
    await m7();
    expect((await db.doc("songbooks/zagateile~acervo/songbookRevisions/1").get()).get("pins")).toEqual(Object.fromEntries(rows.map((row) => [row.scoreId, "1"])));
  });

  it("blocks stale reviewed data before project journals or moves", async () => {
    const id = "carnaval-bh-2026-vaporbarato";
    await seedReviewedScore(id);
    await db.doc(`scores/${id}`).update({ latestRevisionId: "unexpected" });
    await expect(m6()).rejects.toThrow("latest revision changed");
    expect((await catalogJournal(db).collection("projects").get()).empty).toBe(true);
    expect((await db.doc(`scores/${id}`).get()).get("projectId")).toBe("carnaval-bh-2026");
  });
});
