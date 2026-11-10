import {
  getMemberRole,
  getScore,
  getScoreRevision,
  getProject,
} from "./db";
import { FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { isReviewer } from "./roles";
import { resolveScoreMetadata, uploadedScoreMetadata } from "./scoreMetadata";
import type { ScoreData, ScoreMetadata } from "../../types/docs";
import type { ScoreDisplayPart } from "../tsx/ScoreDisplay";

export interface LoadedScore extends ScoreMetadata {
  scoreId: string;
  revisionId: string;
  latestRevisionId: string;
  publishedRevisionId: string | null;
  forkedFrom: ScoreData["forkedFrom"];
  revisionNumber: number;
  uploaded: ScoreMetadata;
  projectId: string;
  projectTitle: string;
  msczUrl: string;
  arrangementMidiUrl: string | null;
  parts: ScoreDisplayPart[];
}

export async function loadScore(
  scoreId: string,
  revisionId: string | undefined,
  uid: string | undefined,
): Promise<LoadedScore> {
  const song = await getScore(scoreId);
  if (!song || song.deletedAt) {
    throw new Error("Partitura não encontrada");
  }

  // Without a version in the URL, members get the latest and everyone else
  // the published one, when there is one (collab-flow §4.4).
  const isMember =
    !!uid && isReviewer(await getMemberRole(song.projectId, uid));
  const publishedId =
    FEATURE_FLAG_COLLAB_FLOW && !isMember
      ? song.published?.revisionId
      : undefined;
  const resolvedRevisionId = revisionId ?? publishedId ?? song.latestRevisionId;
  const [rev, project] = await Promise.all([
    getScoreRevision(scoreId, resolvedRevisionId),
    getProject(song.projectId),
  ]);
  if (!rev) {
    throw new Error("Versão não encontrada");
  }
  // A deleted project hides its scores (collab-flow §6).
  if (project?.deletedAt) {
    throw new Error("Partitura não encontrada");
  }
  const projectTitle = project?.title ?? song.projectId;

  return {
    scoreId,
    revisionId: resolvedRevisionId,
    latestRevisionId: song.latestRevisionId,
    publishedRevisionId: song.published?.revisionId ?? null,
    forkedFrom: song.forkedFrom,
    revisionNumber: rev.revisionNumber,
    ...resolveScoreMetadata(song),
    uploaded: uploadedScoreMetadata(song),
    projectId: song.projectId,
    projectTitle,
    msczUrl: rev.mscz.url,
    arrangementMidiUrl: rev.midi.url || null,
    parts: rev.parts.map((part) => ({
      name: part.name,
      instrument: part.instrument,
      svgUrls: part.svg.map((f) => f.url),
      midiUrl: part.midi.url || null,
    })),
  };
}
