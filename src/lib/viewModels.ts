import type { ScoreDoc, ScoreRevisionDoc } from "../../types/docs";
import type {
  ScoreRevisionViewModel,
  ScoreViewModel,
} from "../../types/viewModels";
import type { WithId } from "./db";
import { resolveScoreMetadata } from "./scoreMetadata";

export function toScoreRevisionViewModel(
  revision: WithId<ScoreRevisionDoc>,
): ScoreRevisionViewModel {
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    uploadedBy: revision.uploadedBy,
    uploadedAt: revision.uploadedAt,
    mscz: revision.mscz.url,
    metajson: revision.metajson.url,
    midi: revision.midi.url,
    parts: revision.parts.map((p) => ({
      ...p,
      svg: p.svg.map((f) => f.url),
      midi: p.midi.url,
    })),
    notes: revision.notes,
  };
}

/** `revision` becomes the view model's `latestRevision`: the one it shows. */
export function toScoreViewModel(
  score: WithId<ScoreDoc>,
  revision: WithId<ScoreRevisionDoc>,
  projectTitle: string,
): ScoreViewModel {
  return {
    id: score.id,
    ...resolveScoreMetadata(score),
    projectId: score.projectId,
    projectTitle,
    latestRevision: toScoreRevisionViewModel(revision),
  };
}
