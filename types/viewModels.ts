import type { Timestamp } from "firebase/firestore";
import type { Instrument } from "./instrument";

export type PartViewModel = {
  name: string;
  instrument: Instrument;
  svg: string[];
  midi: string;
};

export type ScoreRevisionViewModel = {
  id: string;
  revisionNumber: number;
  uploadedBy: string;
  uploadedAt: Timestamp;
  mscz: string;
  metajson: string;
  midi: string;
  parts: PartViewModel[];
  notes: string;
};

export type ScoreViewModel = {
  id: string;
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  projectId: string;
  projectTitle: string;
  latestRevision: ScoreRevisionViewModel;
};

export type SongbookScoreViewModel = {
  type: "score";
  score: ScoreViewModel;
  revision?: ScoreRevisionViewModel;
};

export type SongbookSectionViewModel = {
  type: "section";
  title: string;
};

export type SongbookItemViewModel = SongbookScoreViewModel | SongbookSectionViewModel;

export type SongbookViewModel = {
  items: SongbookItemViewModel[];
};

export type PlayingPartViewModel = {
  score: ScoreViewModel;
  part: PartViewModel;
};
