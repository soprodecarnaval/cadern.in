import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { zSongbookDoc, zSongbookRevisionDoc, type SongbookRevisionContent } from "../../types/docs";
import { songbookScore, toSongbookRevisionContent } from "../../src/lib/songbook";
import { generateCarnivalSections, generateSectionsByStyle } from "../../src/utils/songBookRows";
import { assertCatalog, catalogJournal, type CollabCatalog } from "./collabCatalog";
import * as publishedScores from "../../functions/src/publishedScores";
import { DEFERRED_STYLE_IDS, inferCarnivalStyle } from "./collabStyles";
import { commitInChunks, type Write } from "./batches";

// functions/ is CommonJS; tsx exposes its exports under default from this ESM script.
const { rebuildPublished } = (publishedScores as typeof publishedScores & { default?: typeof publishedScores }).default ?? publishedScores;

// Reviewed exceptions belong here, keyed by score ID with the reason it can leave the homepage.
export const APPROVED_HOMEPAGE_OMISSIONS: Record<string, string> = {};

export function planSongbooks(catalog: CollabCatalog) {
  const errors = [...catalog.errors];
  const books: { id: string; project: string; slug: string; source: string; content: SongbookRevisionContent; existing: boolean }[] = [];
  const exclusions: { scoreId: string; songbook: string; reason: string }[] = [];
  const inferences: { scoreId: string; songbook: string; style: string; sourceScoreIds: string[] }[] = [];
  const deferred: { scoreId: string; title: string; songbook: string; reason: string }[] = [];
  const approvedOmissions = new Map(Object.entries(APPROVED_HOMEPAGE_OMISSIONS));
  const candidates = [...catalog.views.values()].filter((view) =>
    !catalog.scores.get(view.id)?.deletedAt && catalog.projects.has(view.projectId) && !catalog.projects.get(view.projectId)?.deletedAt,
  );
  const covered = new Set<string>();
  for (const { book, revision } of catalog.books.values()) {
    if (book.isPublished && !book.deletedAt && !catalog.projects.get(book.projectId)?.deletedAt && catalog.projects.has(book.projectId)) {
      for (const id of Object.keys(revision?.pins ?? {})) covered.add(id);
    }
  }
  for (const row of catalog.assignments) {
    if (row.songbook === null) {
      for (const scoreId of row.scoreIds) approvedOmissions.set(scoreId, `Retired project ${row.source}; scores/files retained`);
      continue;
    }
    const carnivalGrouping = (row.grouping ?? (row.project === "carnaval-bh" ? "carnival" : "style")) === "carnival";
    const id = `${row.project}~${row.songbook}`;
    const existing = catalog.books.get(id);
    const journal = catalog.bookJournals.get(id);
    if (existing) {
      if (journal?.source !== row.source || !existing.revision || existing.book.projectId !== row.project) {
        errors.push(`Songbook collision or missing revision: ${row.project}/${row.songbook}`);
      }
      books.push({ id, project: row.project, slug: row.songbook, source: row.source, content: existing.revision ?? { entries: [], pins: {}, covers: {} }, existing: true });
      continue;
    }
    if (journal) errors.push(`Journaled songbook is missing: ${row.project}/${row.songbook}`);
    const views = row.scoreIds.flatMap((scoreId) => {
      const score = catalog.scores.get(scoreId);
      const view = catalog.views.get(scoreId);
      if (score?.deletedAt) return [];
      if (!view) {
        exclusions.push({ scoreId, songbook: `${row.project}/${row.songbook}`, reason: "missing latest revision" });
        return [];
      }
      let tags = view.tags[0]?.trim() ? view.tags : ["Sem estilo", ...view.tags.slice(1)];
      if (carnivalGrouping) {
        const result = inferCarnivalStyle(view, candidates);
        if (result.style) {
          tags = [result.style, ...view.tags.slice(1)];
          if (result.status === "inferred") inferences.push({ scoreId, songbook: `${row.project}/${row.songbook}`, style: result.style, sourceScoreIds: result.sourceScoreIds });
        } else {
          const reason = result.status === "conflict" ? `Conflicting styles from ${result.sourceScoreIds.join(", ")}` : "No matching style in existing live scores";
          exclusions.push({ scoreId, songbook: `${row.project}/${row.songbook}`, reason });
          if (result.status === "missing" && DEFERRED_STYLE_IDS.has(scoreId)) {
            deferred.push({ scoreId, title: view.title, songbook: `${row.project}/${row.songbook}`, reason });
            approvedOmissions.set(scoreId, "Style review deferred by user; score retained in destination project");
          }
          return [];
        }
      }
      return [{ ...view, projectId: row.project, tags }];
    }).sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
    const rows = views.map(songbookScore);
    const grouped = carnivalGrouping ? generateCarnivalSections(rows) : generateSectionsByStyle(rows);
    const content = toSongbookRevisionContent(grouped);
    for (const view of views) {
      if (!(view.id in content.pins)) exclusions.push({ scoreId: view.id, songbook: `${row.project}/${row.songbook}`, reason: `unrecognized carnival style: ${view.tags[0]}` });
    }
    for (const scoreId of Object.keys(content.pins)) covered.add(scoreId);
    books.push({ id, project: row.project, slug: row.songbook, source: row.source, content, existing: false });
  }
  const omissions = [...catalog.baseline].filter((id) => !covered.has(id)).sort();
  return { books, errors, exclusions, omissions, inferences, deferred, approvedOmissions };
}

export function reportSongbooks(plan: ReturnType<typeof planSongbooks>) {
  console.table(plan.books.map((book) => ({ songbook: `${book.project}/${book.slug}`, scores: Object.keys(book.content.pins).length, action: book.existing ? "preserve" : "create published" })));
  if (plan.exclusions.length) console.table(plan.exclusions);
  console.log(`Inferred styles: ${plan.inferences.length}; deferred style reviews: ${plan.deferred.length}`);
  if (plan.inferences.length) console.table(plan.inferences.map((row) => ({ ...row, sourceScoreIds: row.sourceScoreIds.join(", ") })));
  console.log(`Homepage omissions: ${plan.omissions.length}`);
  for (const scoreId of plan.omissions) console.log(`  ${scoreId}: ${plan.approvedOmissions.get(scoreId) ?? "REVIEW REQUIRED"}`);
}

export async function migrateSongbooks(db: Firestore, catalog: CollabCatalog, owner: string, dryRun: boolean) {
  const plan = planSongbooks(catalog);
  reportSongbooks(plan);
  assertCatalog(plan.errors);
  if (dryRun) return;
  assertCatalog(plan.omissions.filter((id) => !plan.approvedOmissions.has(id)).map((id) => `Unreviewed homepage omission: ${id}`));
  if (catalog.assignments.some((row) => !catalog.savedSources.has(row.source))) throw new Error("Apply M6 before M7");
  for (const row of catalog.assignments) {
    if (row.scoreIds.some((id) => catalog.scores.get(id)?.projectId !== row.project)) throw new Error(`M6 has not finished moving scores: ${row.source}`);
  }
  const timestamp = Timestamp.now();
  // Save evidence before creating books, so retries cannot lose the inference/review trail.
  for (const [name, rows] of [["styleInferences", plan.inferences], ["deferredStyles", plan.deferred]] as const) {
    const collection = catalogJournal(db).collection(name);
    const existing = new Set((await collection.get()).docs.map((doc) => doc.id));
    const writes: Write[] = rows.filter((row) => !existing.has(row.scoreId)).map((row) => (batch) =>
      batch.create(collection.doc(row.scoreId), { ...row, createdAt: timestamp }),
    );
    await commitInChunks(db, writes);
  }
  for (const book of plan.books) {
    if (book.existing) continue;
    const ref = db.collection("songbooks").doc(book.id);
    const revision = zSongbookRevisionDoc.parse({
      ...book.content, revisionNumber: 1, prevRevisionId: null, createdBy: owner,
      createdAt: timestamp, note: `Migração de ${book.source}`,
    });
    const container = zSongbookDoc.parse({
      title: `${book.project}/${book.slug}`, projectId: book.project, slug: book.slug,
      currentRevisionId: "1", isPublished: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    });
    // Container, immutable revision and provenance succeed or fail together.
    const batch = db.batch();
    batch.create(ref, container);
    batch.create(ref.collection("songbookRevisions").doc("1"), revision);
    batch.create(catalogJournal(db).collection("songbooks").doc(book.id), { source: book.source, revisionId: "1", createdAt: timestamp });
    await batch.commit();
  }
  // CI migrates before deploying functions, so initial publication cannot rely on triggers.
  const changes = await rebuildPublished(db, false);
  console.log(`${changes.length} published markers rebuilt`);
}
