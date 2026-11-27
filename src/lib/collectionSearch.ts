import Fuse, { type IFuseOptions } from "fuse.js";
import type { ScoreViewModel } from "../../types/viewModels";

/** What the search looks at: title, composer, tags (styles) and arrangement. */
type Searchable = Pick<ScoreViewModel, "title" | "composer" | "tags" | "projectTitle">;

const SEARCH_KEYS = ["title", "composer", "tags", "projectTitle"];

const fuseOptions = {
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
  threshold: 0.1,
  useExtendedSearch: true,
  ignoreDiacritics: true,
  ignoreLocation: true,
} satisfies Omit<IFuseOptions<Searchable>, "keys">;

/**
 * Montar's search (fuzzy, with quotes and ^ for exact search), over any
 * list of songs; `extraKeys` adds fields of their own (the edit screen's
 * songbook names).
 */
export function createCollectionSearch<T extends Searchable>(scores: T[], extraKeys: string[] = []) {
  const keys = [...SEARCH_KEYS, ...extraKeys];
  const index = Fuse.createIndex(keys, scores);
  const fuse = new Fuse(scores, { ...fuseOptions, keys }, index);
  return {
    search: (query: string): T[] => query === ""
      ? scores
      : fuse.search(query).map((result) => result.item),
    getMatches: (query: string, scoreId: string) => query === ""
      ? undefined
      : fuse.search(query).find((result) => (result.item as { id?: string }).id === scoreId)?.matches,
  };
}
