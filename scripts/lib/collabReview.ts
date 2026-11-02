import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { zScoreDoc, type ScoreDoc } from "../../types/docs";
import { resolveScoreMetadata } from "../../src/lib/scoreMetadata";
import { assertCatalog, catalogJournal, type CollabCatalog } from "./collabCatalog";

const zDecision = z.object({
  scoreId: z.string(), title: z.string(), source: z.string(), project: z.string(),
  revisionId: z.string(), originalTags: z.array(z.string()), excluded: z.boolean(),
  style: z.string().nullable(), styleKind: z.enum(["reviewed", "chain", "inferred"]).nullable(),
  styleEvidence: z.array(z.string()), deferred: z.boolean(),
  predecessor: z.object({ scoreId: z.string(), revisionId: z.string(), projectId: z.string() }).nullable(),
});
export type ScoreDecision = z.infer<typeof zDecision>;
const manifest = z.object({ snapshotAt: z.string(), scores: z.array(zDecision) }).parse(
  JSON.parse(readFileSync(new URL("../data/collabReviewedScores.json", import.meta.url), "utf8")),
);
export const REVIEWED_SCORES = new Map(manifest.scores.map((row) => [row.scoreId, row]));
if (REVIEWED_SCORES.size !== manifest.scores.length) throw new Error("Duplicate reviewed score IDs");

const decisionHash = (row: ScoreDecision) => createHash("sha256").update(JSON.stringify(row)).digest("hex");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const correctedTags = (row: ScoreDecision) => [row.style!, ...row.originalTags.slice(1)];
const correctsTags = (row: ScoreDecision) => row.styleKind === "reviewed" || row.styleKind === "chain";

export function reviewedStyle(catalog: CollabCatalog, id: string): string | null {
  const row = REVIEWED_SCORES.get(id);
  if (!row?.style) return null;
  const tags = catalog.views.get(id)?.tags;
  if (catalog.scoreJournals.has(id) && !same(tags, correctsTags(row) ? correctedTags(row) : row.originalTags)) return null;
  return row.style;
}

function validateScore(row: ScoreDecision, score: ScoreDoc): string[] {
  const errors: string[] = [];
  if (score.projectId !== row.source && score.projectId !== row.project) errors.push("project changed");
  if (score.title !== row.title || resolveScoreMetadata(score).title !== row.title) errors.push("title changed");
  if (score.latestRevisionId !== row.revisionId) errors.push("latest revision changed");
  if (!same(resolveScoreMetadata(score).tags, row.originalTags)) errors.push("tags changed");
  if (score.forkedFrom && !same(score.forkedFrom, row.predecessor)) errors.push("lineage already differs");
  return errors.map((error) => `Reviewed score ${row.scoreId}: ${error}; refresh review before migrating`);
}

export function planReviewedScores(catalog: CollabCatalog) {
  const errors: string[] = [];
  const changes: ScoreDecision[] = [];
  for (const row of REVIEWED_SCORES.values()) {
    const score = catalog.scores.get(row.scoreId);
    if (!score) continue;
    const journal = catalog.scoreJournals.get(row.scoreId);
    if (journal) {
      if (journal.decisionHash !== decisionHash(row)) errors.push(`Applied score decision changed: ${row.scoreId}`);
      continue;
    }
    const hasChanges = row.excluded || !!row.predecessor || correctsTags(row);
    if (score.deletedAt || (!hasChanges && !row.style)) continue;
    if (catalog.projects.get(score.projectId)?.deletedAt && !catalog.assignments.some((assignment) => assignment.scoreIds.includes(row.scoreId))) continue;
    errors.push(...validateScore(row, score));
    if (!catalog.views.has(row.scoreId)) errors.push(`Reviewed score has no latest revision: ${row.scoreId}`);
    const assignment = catalog.assignments.find((assignment) => assignment.scoreIds.includes(row.scoreId));
    if (!assignment || assignment.source !== row.source || assignment.project !== row.project) {
      errors.push(`Reviewed score assignment changed: ${row.scoreId}`);
    }
    if (row.predecessor) {
      const source = catalog.scores.get(row.predecessor.scoreId);
      const sourceDecision = REVIEWED_SCORES.get(row.predecessor.scoreId);
      if (!source || source.deletedAt || !sourceDecision || sourceDecision.excluded || !catalog.views.has(row.predecessor.scoreId) ||
          source.latestRevisionId !== row.predecessor.revisionId || source.title !== sourceDecision.title ||
          resolveScoreMetadata(source).title !== sourceDecision.title ||
          ![sourceDecision.source, row.predecessor.projectId].includes(source.projectId)) {
        errors.push(`Reviewed predecessor changed or missing: ${row.scoreId} -> ${row.predecessor.scoreId}`);
      }
    }
    if (hasChanges) changes.push(row);
  }
  return { changes, errors };
}

export function reportReviewedScores(plan: ReturnType<typeof planReviewedScores>) {
  console.log(`Reviewed score changes: ${plan.changes.length}; snapshot ${manifest.snapshotAt}`);
  console.log(`  Tags: ${plan.changes.filter(correctsTags).length}; lineage: ${plan.changes.filter((row) => row.predecessor).length}; rejected duplicates: ${plan.changes.filter((row) => row.excluded).length}`);
}

const scoreState = (score: ScoreDoc) => JSON.stringify({
  title: score.title, latestRevisionId: score.latestRevisionId, tags: score.tags,
  cachedMetadata: score.cachedMetadata, metadataOverride: score.metadataOverride,
  forkedFrom: score.forkedFrom, deletedAt: score.deletedAt,
});

export async function applyReviewedScores(db: Firestore, catalog: CollabCatalog, dryRun: boolean) {
  const plan = planReviewedScores(catalog);
  assertCatalog(plan.errors);
  reportReviewedScores(plan);
  if (dryRun) return;
  for (const row of plan.changes) {
    await db.runTransaction(async (transaction) => {
      const ref = db.doc(`scores/${row.scoreId}`);
      const journalRef = catalogJournal(db).collection("scores").doc(row.scoreId);
      const [doc, journal] = await transaction.getAll(ref, journalRef);
      if (journal.exists) {
        if (journal.get("decisionHash") !== decisionHash(row)) throw new Error(`Applied score decision changed: ${row.scoreId}`);
        return;
      }
      const score = zScoreDoc.parse(doc.data());
      if (scoreState(score) !== scoreState(catalog.scores.get(row.scoreId)!) ||
          ![row.source, row.project].includes(score.projectId)) {
        throw new Error(`Score changed during M6; stop writers and retry: ${row.scoreId}`);
      }
      if (row.predecessor) {
        const source = await transaction.get(db.doc(`scores/${row.predecessor.scoreId}`));
        const expectedSource = REVIEWED_SCORES.get(row.predecessor.scoreId)!;
        if (!source.exists || source.get("deletedAt") || source.get("latestRevisionId") !== row.predecessor.revisionId ||
            source.get("title") !== expectedSource.title || resolveScoreMetadata(zScoreDoc.parse(source.data())).title !== expectedSource.title ||
            source.get("projectId") !== row.predecessor.projectId) {
          throw new Error(`Predecessor changed during M6: ${row.scoreId}`);
        }
      }
      const patch: {
        deletedAt?: Timestamp; tags?: string[]; "metadataOverride.tags"?: string[];
        forkedFrom?: NonNullable<ScoreDoc["forkedFrom"]>;
      } = {};
      if (row.excluded) patch.deletedAt = Timestamp.now();
      else {
        if (correctsTags(row)) {
          patch.tags = correctedTags(row);
          patch["metadataOverride.tags"] = correctedTags(row);
        }
        if (row.predecessor) patch.forkedFrom = row.predecessor;
      }
      transaction.create(journalRef, {
        decisionHash: decisionHash(row), decision: row, snapshotAt: manifest.snapshotAt,
        before: { tags: score.tags, metadataOverride: score.metadataOverride ?? null,
          forkedFrom: score.forkedFrom ?? null, deletedAt: score.deletedAt ?? null },
        appliedAt: Timestamp.now(),
      });
      transaction.update(ref, patch);
    });
  }
}
