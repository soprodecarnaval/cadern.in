import type { Instrument } from "./instrument";

export type SongbookScoreViewModel = {
  type: "score";
  score: ScoreViewModel;
  revision?: RevisionViewModel;
};

export type SongbookSectionViewModel = {
  type: "section";
  title: string;
};

export type SongbookItemViewModel = SongbookScoreViewModel | SongbookSectionViewModel;

export type SongbookViewModel = {
  items: SongbookItemViewModel[];
};

export const isSongbookSection = (item: SongbookItemViewModel): item is SongbookSectionViewModel =>
  item.type === "section";

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

export type PartViewModel = {
  name: string;
  instrument: Instrument;
  svg: string[];
  midi: string;
};

export type RevisionViewModel = {
  id: string;
  revisionNumber: number;
  uploadedBy: string;
  uploadedAt: any;
  mscz: string;
  metajson: string;
  midi: string;
  parts: PartViewModel[];
  notes: string;
  isLatest: boolean;
};

export type ScoreViewModel = {
  id: string;
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  projectTitle: string;
  latestRevision: RevisionViewModel;
};

export type PlayingPart = {
  score: ScoreViewModel;
  part: PartViewModel;
};
