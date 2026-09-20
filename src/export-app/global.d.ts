import type { ScoreMeta } from "../../scripts/lib/scoreMeta";
import type { MetadataTags } from "../../scripts/lib/msczMeta";
import type {
  ExportResult,
  RunExportOptions,
} from "../../scripts/lib/exportScore";

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
  pickExportDirectory(): Promise<string | null>;
  getDroppedPath(file: File): string;
  readScoreMeta(msczPath: string): Promise<ScoreMeta>;
  copyMsczWithMeta(
    sourcePath: string,
    destinationPath: string,
    tags: MetadataTags,
  ): Promise<string>;
  runExport(
    options: Omit<RunExportOptions, "mscorePath">,
  ): Promise<ExportResult>;
  openFolder(folderPath: string): Promise<string>;
}

declare global {
  interface Window {
    api: ExportApi;
  }
}
