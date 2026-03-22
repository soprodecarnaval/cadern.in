import { createContext, useContext } from "react";
import type { Score } from "../types";

export type CollectionStatus = "loading" | "ready" | "error";

export interface CollectionContextValue {
  status: CollectionStatus;
  allScores: Score[];
  search: (query: string) => Score[];
}

export const CollectionContext = createContext<CollectionContextValue | null>(null);

export function useCollectionContext(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx)
    throw new Error("useCollectionContext must be used within CollectionProvider");
  return ctx;
}
