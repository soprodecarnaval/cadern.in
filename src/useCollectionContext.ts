import { createContext, useContext } from "react";
import type { FuseResultMatch } from "fuse.js";
import type { ScoreViewModel } from "../types/viewModels";

export type CollectionStatus = "loading" | "ready" | "error";

export interface CollectionContextValue {
  status: CollectionStatus;
  allScores: ScoreViewModel[];
  search: (query: string) => ScoreViewModel[];
  /** Per-field match ranges for a score against the given query — library
   * search-highlighting only, not meaningful once a score leaves the library. */
  getMatches: (
    query: string,
    scoreId: string,
  ) => readonly FuseResultMatch[] | undefined;
}

export const CollectionContext = createContext<CollectionContextValue | null>(
  null,
);

export function useCollectionContext(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error(
      "useCollectionContext must be used within CollectionProvider",
    );
  }
  return ctx;
}
