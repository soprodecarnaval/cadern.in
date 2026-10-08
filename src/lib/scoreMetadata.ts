import type { ScoreData, ScoreMetadata } from "../../types/docs";

type ScoreMetadataSource = Pick<
  ScoreData,
  "title" | "composer" | "sub" | "tags" | "cachedMetadata" | "metadataOverride"
>;

/**
 * Metadata as uploaded: the latest revision's, falling back to the legacy
 * top-level fields for scores collab-flow M4 hasn't backfilled.
 */
export function uploadedScoreMetadata(score: ScoreMetadataSource): ScoreMetadata {
  return (
    score.cachedMetadata ?? {
      title: score.title,
      composer: score.composer,
      sub: score.sub,
      tags: score.tags,
    }
  );
}

/** What to display: admin corrections win field by field (collab-flow §2.2). */
export function resolveScoreMetadata(score: ScoreMetadataSource): ScoreMetadata {
  const override = score.metadataOverride ?? {};
  const uploaded = uploadedScoreMetadata(score);
  return {
    title: override.title ?? uploaded.title,
    composer: override.composer ?? uploaded.composer,
    sub: override.sub ?? uploaded.sub,
    tags: override.tags ?? uploaded.tags,
  };
}
