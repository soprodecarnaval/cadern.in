import type { SongbookRevisionDoc } from "../../types/docs";
import type { ScoreViewModel } from "../../types/viewModels";
import { getProject, getScore, getScoreRevision } from "./db";
import { toScoreViewModel } from "./viewModels";

/**
 * Each score a songbook revision pins, as a view model at its pinned
 * revision. Scores or revisions that can't be found are left out.
 */
export async function loadPinnedScores(
  revision: Pick<SongbookRevisionDoc, "pins">,
): Promise<Map<string, ScoreViewModel>> {
  const projectTitles = new Map<string, Promise<string>>();
  const projectTitle = (id: string) => {
    if (!projectTitles.has(id)) {
      projectTitles.set(id, getProject(id).then((p) => p?.title ?? id));
    }
    return projectTitles.get(id)!;
  };

  const entries = await Promise.all(
    Object.entries(revision.pins).map(async ([scoreId, revisionId]) => {
      const [score, pinned] = await Promise.all([
        getScore(scoreId),
        getScoreRevision(scoreId, revisionId),
      ]);
      if (!score || !pinned) {
        return null;
      }
      return [
        scoreId,
        toScoreViewModel(score, pinned, await projectTitle(score.projectId)),
      ] as const;
    }),
  );
  return new Map(
    entries.filter((e): e is readonly [string, ScoreViewModel] => e !== null),
  );
}
