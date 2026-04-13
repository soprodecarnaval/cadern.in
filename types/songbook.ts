import type { ScoreViewModel, RevisionViewModel } from "./viewModels";

export type SongBookScore = {
  type: "score";
  score: ScoreViewModel;
  revision?: RevisionViewModel;
};

export const getRevision = (item: SongBookScore): RevisionViewModel =>
  item.revision ?? item.score.latestRevision;

export type SongBookSection = {
  type: "section";
  title: string;
};

export type SongBookItem = SongBookScore | SongBookSection;

export type SongBook = {
  items: SongBookItem[];
};

export const isSongBookSection = (row: SongBookItem): row is SongBookSection =>
  row.type === "section";

export const songBookScore = (score: ScoreViewModel): SongBookScore => ({
  type: "score",
  score,
});

export const songBookSection = (title: string): SongBookSection => ({
  type: "section",
  title,
});
