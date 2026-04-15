import type {
  ScoreViewModel,
  RevisionViewModel,
  SongbookScoreViewModel,
  SongbookSectionViewModel,
  SongbookItemViewModel,
} from "../../types/viewModels";

export const isSongbookSection = (
  item: SongbookItemViewModel,
): item is SongbookSectionViewModel => item.type === "section";

export const songbookScore = (score: ScoreViewModel): SongbookScoreViewModel => ({
  type: "score",
  score,
});

export const songbookSection = (title: string): SongbookSectionViewModel => ({
  type: "section",
  title,
});

export const getRevision = (item: SongbookScoreViewModel): RevisionViewModel =>
  item.revision ?? item.score.latestRevision;
