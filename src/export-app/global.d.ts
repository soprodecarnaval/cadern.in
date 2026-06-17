import type { ScorePart } from "../../scripts/lib/scoreMeta";

// Bridge exposed by electron/preload.ts via contextBridge.
export interface ExportApi {
  getMscorePath(): Promise<string | null>;
  setMscorePath(
    path: string,
  ): Promise<{ ok: boolean; path?: string; error?: string }>;
  locateMscore(): Promise<{
    ok: boolean;
    path?: string;
    error?: string;
  } | null>;
  pickMscz(): Promise<string | null>;
  listParts(msczPath: string): Promise<ScorePart[]>;
}

declare global {
  interface Window {
    api: ExportApi;
  }
}
