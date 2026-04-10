import { createContext, useContext } from "react";
import type { LegacyScore } from "../types";

export type CollectionStatus = "loading" | "ready" | "error";

export interface CollectionContextValue {
  status: CollectionStatus;
  allLegacyScores: LegacyScore[];
  search: (query: string) => LegacyScore[];
}

export const CollectionContext = createContext<CollectionContextValue | null>(null);

export function useCollectionContext(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx)
    throw new Error("useCollectionContext must be used within CollectionProvider");
  return ctx;
}
