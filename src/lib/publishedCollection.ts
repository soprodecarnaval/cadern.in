import type { ProjectDoc, ScoreDoc, ScoreRevisionDoc } from "../../types/docs";
import type { ScoreViewModel } from "../../types/viewModels";
import type { WithId } from "./db";
import { groupScoreVersions } from "./scorePicker";
import { toScoreViewModel } from "./viewModels";

export interface LoadedCollection {
  allScores: ScoreViewModel[];
  searchScores: ScoreViewModel[];
}

export async function buildPublishedCollection(
  projects: WithId<ProjectDoc>[],
  lineage: WithId<ScoreDoc>[],
  getRevision: (scoreId: string, revisionId: string) => Promise<WithId<ScoreRevisionDoc> | null>,
): Promise<LoadedCollection> {
  const titles = new Map(projects.filter((p) => !p.deletedAt).map((p) => [p.id, p.title]));
  const candidates = lineage.filter((s) => !s.deletedAt && s.published && titles.has(s.projectId));
  const loaded = await Promise.all(candidates.map(async (doc) => {
    const revision = await getRevision(doc.id, doc.published!.revisionId);
    return revision ? { doc, score: toScoreViewModel(doc, revision, titles.get(doc.projectId)!) } : null;
  }));
  const available = loaded.filter((s): s is NonNullable<typeof s> => s !== null);
  return {
    allScores: available.map((s) => s.score),
    searchScores: groupScoreVersions(available, lineage).map((group) => group[0].score),
  };
}
