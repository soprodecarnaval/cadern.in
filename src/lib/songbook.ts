import type {
  SongbookEntry,
  SongbookRevisionContent,
  SongbookRevisionDoc,
} from "../../types/docs";
import type {
  ScoreViewModel,
  ScoreRevisionViewModel,
  SongbookScoreViewModel,
  SongbookSectionViewModel,
  SongbookItemViewModel,
} from "../../types/viewModels";

export const songbookPath = (projectId: string, slug: string) =>
  `/projects/${encodeURIComponent(projectId)}/songbooks/${encodeURIComponent(slug)}`;

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

export const getScoreRevision = (
  item: SongbookScoreViewModel,
): ScoreRevisionViewModel =>
  item.revision ?? item.score.latestRevision;

/**
 * A builder list as songbook revision content: entries in list order, score
 * numbers frozen over score entries only, and each score pinned to the
 * revision the builder shows. A score may appear only once (pins are keyed by
 * score id).
 */
export function toSongbookRevisionContent(
  items: SongbookItemViewModel[],
  covers: SongbookRevisionContent["covers"] = {},
): SongbookRevisionContent {
  const pins: Record<string, string> = {};
  let index = 0;
  const entries: SongbookEntry[] = items.map((item, order) => {
    if (isSongbookSection(item)) {
      return { type: "section", title: item.title, order };
    }
    if (pins[item.score.id]) {
      throw new Error(`"${item.score.title}" aparece mais de uma vez`);
    }
    pins[item.score.id] = getScoreRevision(item).id;
    return { type: "score", scoreId: item.score.id, order, index: ++index };
  });
  return { entries, pins, covers };
}

/**
 * A revision back as a builder list. `scores` holds each pinned score at its
 * pinned revision; entries whose score is missing are skipped.
 */
export function fromSongbookRevision(
  revision: Pick<SongbookRevisionDoc, "entries">,
  scores: Map<string, ScoreViewModel>,
): SongbookItemViewModel[] {
  return [...revision.entries]
    .sort((a, b) => a.order - b.order)
    .flatMap((entry): SongbookItemViewModel[] => {
      if (entry.type === "section") {
        return [songbookSection(entry.title)];
      }
      const score = scores.get(entry.scoreId);
      return score ? [songbookScore(score)] : [];
    });
}
