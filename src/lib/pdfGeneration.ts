import type { Instrument } from "../../types/instrument";
import type {
  ScoreViewModel,
  ScoreRevisionViewModel,
  NumberedSongbookItemViewModel,
  SongbookScoreViewModel,
} from "../../types/viewModels";
import { isSongbookSection, getScoreRevision } from "./songbook";

export const allInstruments: Instrument[] = [
  "trompete",
  "trombone",
  "sax alto",
  "sax soprano",
  "sax tenor",
  "sax baritono",
  "flauta",
  "tuba",
  "tuba eb",
  "bombardino",
  "clarinete",
];

// Fallback instrument mapping: when primary instrument is missing, use fallback
export const instrumentFallbacks: Partial<Record<Instrument, Instrument>> = {
  clarinete: "sax tenor",
};

export type SectionScore = {
  score: ScoreViewModel;
  revision: ScoreRevisionViewModel;
  index: number;
  // Soft-deleted since the revision was saved: keeps its number, gets no pages.
  deleted?: boolean;
};

export type Section = {
  title: string;
  scores: SectionScore[];
};

export interface InstrumentStat {
  instrument: Instrument;
  count: number;
  countWithFallback?: number;
}

/** Which instruments have parts and how many scores have each. */
export function computeInstrumentStats(
  scores: SongbookScoreViewModel[],
): { stats: InstrumentStat[]; totalScores: number } {
  const totalScores = scores.length;
  const stats: InstrumentStat[] = [];

  for (const instrument of allInstruments) {
    const count = scores.filter((s) =>
      getScoreRevision(s).parts?.some((p) => p.instrument === instrument),
    ).length;

    const fallback = instrumentFallbacks[instrument];
    let countWithFallback: number | undefined;
    if (fallback) {
      countWithFallback = scores.filter(
        (s) =>
          getScoreRevision(s).parts?.some((p) => p.instrument === instrument) ||
          getScoreRevision(s).parts?.some((p) => p.instrument === fallback),
      ).length;
    }

    if (count > 0 || (countWithFallback && countWithFallback > 0)) {
      stats.push({ instrument, count, countWithFallback });
    }
  }

  // Sort by count descending
  stats.sort((a, b) => b.count - a.count);

  return { stats, totalScores };
}

/** Groups a songbook's flat item list into sections for PDF generation. */
export function buildSongbookSections(items: NumberedSongbookItemViewModel[]): Section[] {
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const item of items) {
    if (isSongbookSection(item)) {
      currentSection = { title: item.title, scores: [] };
      sections.push(currentSection);
    } else {
      if (!currentSection) {
        currentSection = { title: "", scores: [] };
        sections.push(currentSection);
      }
      currentSection.scores.push({
        score: item.score,
        revision: getScoreRevision(item),
        index: item.index,
        deleted: item.deleted,
      });
    }
  }

  return sections;
}
