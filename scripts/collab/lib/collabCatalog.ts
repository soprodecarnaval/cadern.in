import { z } from "zod";
import type { Firestore } from "firebase-admin/firestore";
import { zProjectDoc, zScoreDoc, zScoreRevisionDoc, zSongbookDoc, zSongbookRevisionDoc, zProjectMemberDoc } from "../../../types/docs";
import { toScoreViewModel } from "../../../src/lib/viewModels";
import { revisionsByScore } from "../../lib/scoreRevisions";
import { planAssignments, type SourceAssignment } from "./collabMapping";

export const catalogJournal = (db: Firestore) => db.doc("_meta/collabFlow");

const zAssignment = z.object({
  source: z.string(), project: z.string(), title: z.string(), songbook: z.string().nullable(), scoreIds: z.array(z.string()),
  grouping: z.enum(["carnival", "style"]).optional(),
});

export async function loadCollabCatalog(db: Firestore) {
  const [projectDocs, scoreDocs, revisions, journals, bookDocs, bookJournals, memberDocs, scoreJournals] = await Promise.all([
    db.collection("projects").get(), db.collection("scores").get(), revisionsByScore(db),
    catalogJournal(db).collection("projects").get(), db.collection("songbooks").get(),
    catalogJournal(db).collection("songbooks").get(), db.collectionGroup("members").get(),
    catalogJournal(db).collection("scores").get(),
  ]);
  const projects = new Map(projectDocs.docs.map((doc) => [doc.id, { id: doc.id, ...zProjectDoc.parse(doc.data()) }]));
  const scores = new Map(scoreDocs.docs.map((doc) => [doc.id, { id: doc.id, ...zScoreDoc.parse(doc.data()) }]));
  const members = memberDocs.docs.filter((doc) => doc.ref.parent.parent?.parent.id === "projects")
    .map((doc) => ({ projectId: doc.ref.parent.parent!.id, ...zProjectMemberDoc.parse(doc.data()) }));
  const saved = journals.docs.map((doc) => zAssignment.parse(doc.data()));
  const plan = planAssignments([...projects.values()], [...scores.values()], saved);
  const originallyLive = new Set(saved.flatMap((row) => row.scoreIds));
  const baseline = new Set([...scores.values()].filter((score) =>
    !score.deletedAt && projects.has(score.projectId) && (!projects.get(score.projectId)?.deletedAt || originallyLive.has(score.id)) &&
    [...(revisions.get(score.id)?.values() ?? [])].some((copies) => copies.some((copy) => copy.get("isLatest") === true)),
  ).map((score) => score.id));
  const views = new Map([...scores.values()].flatMap((score) => {
    const copies = revisions.get(score.id)?.get(score.latestRevisionId);
    const latest = copies?.find((copy) => copy.ref.parent.id === "scoreRevisions") ?? copies?.[0];
    if (!latest) return [];
    const revision = zScoreRevisionDoc.parse(latest.data());
    return [[score.id, toScoreViewModel(score, { id: latest.id, ...revision }, projects.get(score.projectId)?.title ?? score.projectId)] as const];
  }));
  const books = new Map(await Promise.all(bookDocs.docs.map(async (doc) => {
    const book = { id: doc.id, ...zSongbookDoc.parse(doc.data()) };
    const current = book.currentRevisionId ? await doc.ref.collection("songbookRevisions").doc(book.currentRevisionId).get() : null;
    return [doc.id, { book, revision: current?.exists ? zSongbookRevisionDoc.parse(current.data()) : null }] as const;
  })));
  return {
    projects, scores, members, views, books, baseline,
    assignments: plan.assignments, errors: plan.errors,
    savedSources: new Set(saved.map((row) => row.source)),
    bookJournals: new Map(bookJournals.docs.map((doc) => [doc.id, doc.data()])),
    scoreJournals: new Map(scoreJournals.docs.map((doc) => [doc.id, doc.data()])),
  };
}

export type CollabCatalog = Awaited<ReturnType<typeof loadCollabCatalog>>;

export function reportAssignments(assignments: SourceAssignment[]) {
  console.table(assignments.map((row) => ({
    source: row.source, destination: row.songbook === null ? "archive project (retain scores)" : `${row.project}/${row.songbook}`, scores: row.scoreIds.length,
    archiveSource: row.songbook === null || row.source !== row.project,
  })));
}

export function assertCatalog(errors: string[]) {
  if (errors.length) throw new Error(`Catalog migration blocked:\n${errors.join("\n")}`);
}
