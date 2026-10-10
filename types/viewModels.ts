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
  // The score's number in the songbook: frozen in a saved revision, assigned by
  // position for an unsaved list (numberSongbookItems).
  index?: number;
  // Soft-deleted since a saved revision pinned it: keeps its number, gets no
  // pages (collab-flow §5.7).
  deleted?: boolean;
  // The score's current latest revision, when the item comes from a saved
  // revision: differs from the pinned one when a newer version exists.
  latestRevisionId?: string;
};

export type SongbookSectionViewModel = {
  type: "section";
  title: string;
};

export type SongbookItemViewModel = SongbookScoreViewModel | SongbookSectionViewModel;

/** What PDF generation takes: every score numbered. */
export type NumberedSongbookScoreViewModel = SongbookScoreViewModel & {
  index: number;
};
export type NumberedSongbookItemViewModel =
  | NumberedSongbookScoreViewModel
  | SongbookSectionViewModel;

export type SongbookViewModel = {
  items: NumberedSongbookItemViewModel[];
};

export type PlayingPartViewModel = {
  score: ScoreViewModel;
  part: PartViewModel;
};
