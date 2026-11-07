import type {
  SongbookEntry,
  SongbookRevisionContent,
  SongbookRevisionDoc,
} from "../../types/docs";
import type {
  NumberedSongbookItemViewModel,
  ScoreViewModel,
  ScoreRevisionViewModel,
  SongbookScoreViewModel,
  SongbookSectionViewModel,
  SongbookItemViewModel,
} from "../../types/viewModels";

// Shown under the index (PDF and web) when a saved songbook pins scores that
// were deleted since (collab-flow §5.7).
export const REMOVED_SCORES_NOTE =
  "Partituras riscadas foram removidas do acervo.";

export const songbookPath = (projectId: string, slug: string) =>
  `/projects/${encodeURIComponent(projectId)}/songbooks/${encodeURIComponent(slug)}`;

/** Short, shareable URL of a published songbook. */
export const publicSongbookPath = (projectId: string, slug: string) =>
  `/songbooks/${encodeURIComponent(projectId)}/${encodeURIComponent(slug)}`;

export const isSongbookSection = (
  item: SongbookItemViewModel,
): item is SongbookSectionViewModel => item.type === "section";

export const songbookScore = (
  score: ScoreViewModel,
): SongbookScoreViewModel => ({
  type: "score",
  score,
});

export const songbookSection = (title: string): SongbookSectionViewModel => ({
  type: "section",
  title,
});

export const getScoreRevision = (
  item: SongbookScoreViewModel,
): ScoreRevisionViewModel => item.revision ?? item.score.latestRevision;

/**
 * Numbers a list's scores by position, sections excluded — the numbering a
 * saved revision freezes and every PDF prints.
 */
export function numberSongbookItems(
  items: SongbookItemViewModel[],
): NumberedSongbookItemViewModel[] {
  let index = 0;
  return items.map((item) =>
    isSongbookSection(item) ? item : { ...item, index: ++index },
  );
}

/**
 * A builder list as songbook revision content: entries in list order, scores
 * numbered by position, and each score pinned to the revision the builder
 * shows. A score may appear only once (pins are keyed by score id).
 */
export function toSongbookRevisionContent(
  items: SongbookItemViewModel[],
  covers: SongbookRevisionContent["covers"] = {},
): SongbookRevisionContent {
  const pins: Record<string, string> = {};
  const entries: SongbookEntry[] = numberSongbookItems(items).map(
    (item, order) => {
      if (isSongbookSection(item)) {
        return { type: "section", title: item.title, order };
      }
      if (pins[item.score.id]) {
        throw new Error(`"${item.score.title}" aparece mais de uma vez`);
      }
      pins[item.score.id] = getScoreRevision(item).id;
      return {
        type: "score",
        scoreId: item.score.id,
        order,
        index: item.index,
      };
    },
  );
  return { entries, pins, covers };
}

/**
 * A revision back as a builder list, with each score's frozen number and
 * whether it was deleted since. `scores` holds each pinned score at its pinned
 * revision; entries whose score can't be found are skipped.
 */
export function fromSongbookRevision(
  revision: Pick<SongbookRevisionDoc, "entries">,
  scores: Map<
    string,
    { score: ScoreViewModel; deleted: boolean; latestRevisionId?: string }
  >,
): NumberedSongbookItemViewModel[] {
  return [...revision.entries]
    .sort((a, b) => a.order - b.order)
    .flatMap((entry): NumberedSongbookItemViewModel[] => {
      if (entry.type === "section") {
        return [songbookSection(entry.title)];
      }
      const pinned = scores.get(entry.scoreId);
      return pinned
        ? [
            {
              ...songbookScore(pinned.score),
              index: entry.index,
              deleted: pinned.deleted,
              latestRevisionId: pinned.latestRevisionId,
            },
          ]
        : [];
    });
}

/** A newer version of the score exists than the one the songbook pins. */
export const hasNewerVersion = (item: SongbookScoreViewModel): boolean =>
  !item.deleted &&
  !!item.latestRevisionId &&
  item.latestRevisionId !== getScoreRevision(item).id;

/**
 * The current revision's content with the given scores re-pinned to their
 * latest version — the one change editors may make (collab-flow §5.5) — and
 * a note naming them.
 */
export function repinnedContent(
  current: SongbookRevisionContent,
  items: SongbookItemViewModel[],
  scoreIds: string[],
): { content: SongbookRevisionContent; note: string } {
  const pins = { ...current.pins };
  const titles: string[] = [];
  for (const item of items) {
    if (
      !isSongbookSection(item) &&
      scoreIds.includes(item.score.id) &&
      hasNewerVersion(item)
    ) {
      pins[item.score.id] = item.latestRevisionId!;
      titles.push(item.score.title);
    }
  }
  return {
    content: { entries: current.entries, pins, covers: current.covers },
    note: `atualiza: ${titles.join(", ")}`,
  };
}
