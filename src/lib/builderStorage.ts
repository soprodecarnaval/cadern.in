import type { SongbookItemViewModel } from "../../types/viewModels";
import type { ScoreViewModel } from "../../types/viewModels";
import { isSongbookSection, songbookScore, songbookSection } from "./songbook";

// The homepage builder's list, kept across reloads and logins (collab-flow
// 004a). Only ids are stored; scores come back from the loaded collection.
const KEY = "cadernin:builder";

type StoredItem =
  | { type: "section"; title: string }
  | { type: "score"; scoreId: string };

export function storeBuilderItems(items: SongbookItemViewModel[]): void {
  const stored: StoredItem[] = items.map((item) =>
    isSongbookSection(item)
      ? { type: "section", title: item.title }
      : { type: "score", scoreId: item.score.id },
  );
  localStorage.setItem(KEY, JSON.stringify(stored));
}

/** Scores no longer in the collection are dropped. */
export function restoreBuilderItems(
  scores: ScoreViewModel[],
): SongbookItemViewModel[] {
  let stored: StoredItem[];
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredItem[];
  } catch {
    return [];
  }
  const byId = new Map(scores.map((s) => [s.id, s]));
  return stored.flatMap((item): SongbookItemViewModel[] => {
    if (item.type === "section") {
      return [songbookSection(item.title)];
    }
    const score = byId.get(item.scoreId);
    return score ? [songbookScore(score)] : [];
  });
}

// Set while a logged-out user goes through login to save their songbook.
const PENDING_SAVE_KEY = "cadernin:pendingSongbookSave";

export const markPendingSave = () =>
  sessionStorage.setItem(PENDING_SAVE_KEY, "1");

export function takePendingSave(): boolean {
  const pending = sessionStorage.getItem(PENDING_SAVE_KEY) === "1";
  sessionStorage.removeItem(PENDING_SAVE_KEY);
  return pending;
}
