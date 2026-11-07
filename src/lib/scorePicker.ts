import type { ScoreDoc, SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import type { WithId } from "./db";

export function groupScoreVersions<T extends { doc: WithId<ScoreDoc> }>(
  scores: T[],
  lineage: WithId<ScoreDoc>[],
): T[][] {
  const parents = new Map<string, string>();
  const root = (id: string): string => {
    const parent = parents.get(id);
    if (!parent) {return id;}
    const result = root(parent);
    parents.set(id, result);
    return result;
  };
  for (const score of lineage) {
    if (score.forkedFrom) {
      const a = root(score.id);
      const b = root(score.forkedFrom.scoreId);
      if (a !== b) {parents.set(a, b);}
    }
  }
  const docs = new Map(lineage.map((score) => [score.id, score]));
  const depth = (score: WithId<ScoreDoc>) => {
    const seen = new Set([score.id]);
    let parent = score.forkedFrom?.scoreId;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      parent = docs.get(parent)?.forkedFrom?.scoreId;
    }
    return seen.size;
  };
  const groups = new Map<string, T[]>();
  for (const score of scores) {
    const key = JSON.stringify([score.doc.projectId, root(score.doc.id)]);
    const group = groups.get(key) ?? [];
    group.push(score);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) =>
    group.sort((a, b) =>
      depth(b.doc) - depth(a.doc) ||
      b.doc.createdAt.toMillis() - a.doc.createdAt.toMillis() ||
      a.doc.id.localeCompare(b.doc.id),
    ),
  );
}

export function scoreSongbookSources(
  songbooks: { book: WithId<SongbookDoc>; revision: SongbookRevisionDoc | null }[],
): Map<string, string[]> {
  const sources = new Map<string, Set<string>>();
  for (const { book, revision } of songbooks) {
    if (!revision || book.deletedAt) {continue;}
    for (const scoreId of Object.keys(revision.pins)) {
      const labels = sources.get(scoreId) ?? new Set<string>();
      labels.add(`${book.projectId}/${book.slug}`);
      sources.set(scoreId, labels);
    }
  }
  return new Map([...sources].map(([id, labels]) => [id, [...labels].sort()]));
}
