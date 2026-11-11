import Fuse, { type IFuseOptions } from "fuse.js";
import type { ScoreViewModel } from "../../types/viewModels";

const fuseOptions: IFuseOptions<ScoreViewModel> = {
  keys: ["title", "composer", "tags", "projectTitle"],
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
  threshold: 0.1,
  useExtendedSearch: true,
  ignoreDiacritics: true,
  ignoreLocation: true,
};

export function createCollectionSearch(scores: ScoreViewModel[]) {
  const index = Fuse.createIndex(fuseOptions.keys as string[], scores);
  const fuse = new Fuse(scores, fuseOptions, index);
  return {
    search: (query: string): ScoreViewModel[] => query === ""
      ? scores
      : fuse.search(query).map((result) => result.item),
    getMatches: (query: string, scoreId: string) => query === ""
      ? undefined
      : fuse.search(query).find((result) => result.item.id === scoreId)?.matches,
  };
}
