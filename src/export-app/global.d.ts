import type { ScoreMeta } from "../../scripts/lib/scoreMeta";
import type { MetadataTags } from "../../scripts/lib/msczMeta";
import type {
  ExportResult,
  RunExportOptions,
} from "../../scripts/lib/exportScore";
import type { ExportOutcome } from "../../scripts/lib/exportError";
import type { ScoreIdentity } from "../../types/metajson";

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
  /** Writes the uploaded identity into a .mscz's bytes. */
  stampMsczBytes(bytes: Uint8Array, identity: ScoreIdentity): Promise<Uint8Array>;
  /** Writes the uploaded identity into the user's own file. */
  stampMsczFile(msczPath: string, identity: ScoreIdentity): Promise<void>;
  // Resolves with an outcome rather than rejecting; see scripts/lib/exportError.
  runExport(
    options: Omit<RunExportOptions, "mscorePath">,
  ): Promise<ExportOutcome<ExportResult>>;
  /** Reads an exported folder so the renderer can rebuild browser `File`s. */
  readExportFolder(
    folderPath: string,
  ): Promise<{ name: string; bytes: Uint8Array }[]>;
  openFolder(folderPath: string): Promise<string>;
  openMuseScoreDownload(): Promise<void>;
  /** Fires when an OAuth popup window closes; returns an unsubscribe fn. */
  onOAuthPopupClosed(callback: () => void): () => void;
}

declare global {
  interface Window {
    api: ExportApi;
  }
}
