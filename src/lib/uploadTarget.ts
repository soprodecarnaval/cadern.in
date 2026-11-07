import type { ScoreDoc } from "../../types/docs";
import type { ScoreIdentity } from "../../types/metajson";
import {
  getProject,
  getScore,
  getScoreForks,
  getScoreRevision,
  type WithId,
} from "./db";
import { slugify } from "./slugify";

/** What an upload into a project will do (collab-flow §5.3). */
export type UploadTarget =
  | { kind: "new"; scoreId: string }
  | { kind: "version"; scoreId: string; title: string }
  | {
      kind: "fork";
      scoreId: string;
      sourceTitle: string;
      sourceProjectTitle: string;
      source: { scoreId: string; revisionId: string; projectId: string };
    };

export interface UploadTargetLookups {
  getScore(id: string): Promise<WithId<ScoreDoc> | null>;
  getScoreForks(id: string): Promise<WithId<ScoreDoc>[]>;
  revisionExists(scoreId: string, revisionId: string): Promise<boolean>;
  projectTitle(projectId: string): Promise<string>;
}

const defaultLookups: UploadTargetLookups = {
  getScore,
  getScoreForks,
  revisionExists: async (scoreId, revisionId) =>
    (await getScoreRevision(scoreId, revisionId)) !== null,
  projectTitle: async (id) => (await getProject(id))?.title ?? id,
};

const displayTitle = (score: ScoreDoc) =>
  score.metadataOverride?.title ?? score.cachedMetadata?.title ?? score.title;

/**
 * Decides from the identity the exported file carries, not its title:
 * - a score of this project gets a new version, even if retitled;
 * - a score of another project gets a fork here, or a new version of the fork
 *   already here;
 * - without an identity, the score with the title's id gets a new version.
 * Anything else is a new score. Scores' ids are never reused, deleted ones
 * included, so a colliding title takes a numeric suffix.
 */
export async function resolveUploadTarget(
  input: { title: string; source?: ScoreIdentity },
  projectId: string,
  lookups: UploadTargetLookups = defaultLookups,
): Promise<UploadTarget> {
  const version = (score: WithId<ScoreDoc>): UploadTarget => ({
    kind: "version",
    scoreId: score.id,
    title: displayTitle(score),
  });
  const baseId = `${projectId}-${slugify(input.title)}`;
  const freeId = async () => {
    let id = baseId;
    for (let n = 2; await lookups.getScore(id); n++) {
      id = `${baseId}-${n}`;
    }
    return id;
  };

  const source = input.source && (await lookups.getScore(input.source.scoreId));
  if (input.source && source) {
    if (source.projectId === projectId) {
      if (!source.deletedAt) {
        return version(source);
      }
    } else {
      const forks = await lookups.getScoreForks(source.id);
      const existing = forks.find((f) => f.projectId === projectId);
      if (existing) {
        return version(existing);
      }
      return {
        kind: "fork",
        scoreId: await freeId(),
        sourceTitle: displayTitle(source),
        sourceProjectTitle: await lookups.projectTitle(source.projectId),
        source: {
          scoreId: source.id,
          projectId: source.projectId,
          // The version downloaded, when it still exists.
          revisionId: (await lookups.revisionExists(
            source.id,
            input.source.revisionId,
          ))
            ? input.source.revisionId
            : source.latestRevisionId,
        },
      };
    }
  } else {
    const sameTitle = await lookups.getScore(baseId);
    if (sameTitle && !sameTitle.deletedAt) {
      return version(sameTitle);
    }
  }
  return { kind: "new", scoreId: await freeId() };
}
