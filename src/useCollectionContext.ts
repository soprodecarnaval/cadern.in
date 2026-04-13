import { createContext, useContext } from "react";
import type { ScoreViewModel } from "../types/viewModels";

export type CollectionStatus = "loading" | "ready" | "error";

export interface CollectionContextValue {
  status: CollectionStatus;
  allScores: ScoreViewModel[];
  search: (query: string) => ScoreViewModel[];
}

export const CollectionContext = createContext<CollectionContextValue | null>(null);

export function useCollectionContext(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx)
    throw new Error("useCollectionContext must be used within CollectionProvider");
  return ctx;
}
