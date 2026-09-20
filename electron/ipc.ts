import { dialog, ipcMain, shell } from "electron";
import os from "node:os";
import path from "node:path";
import { autolocateMscore, validateMscore } from "../scripts/lib/mscz";
import { readScoreMeta } from "../scripts/lib/scoreMeta";
import {
  copyMsczWithMeta,
  type MetadataTags,
} from "../scripts/lib/msczMeta";
import {
  exportScoreFolder,
  type RunExportOptions,
} from "../scripts/lib/exportScore";
import { ExportError, toExportFailure } from "../scripts/lib/exportError";
import { getMscorePath, setMscorePath } from "./settings";

// Expand a leading ~ from manually-typed paths (native pickers return absolute).
const expandHome = (p: string): string =>
  p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p;

export interface SetResult {
  ok: boolean;
  path?: string;
  error?: string;
}

// Returns a validated MuseScore path: the persisted one if still valid,
// otherwise autolocate (and persist). null if none found.
function resolveMscorePath(): string | null {
  const saved = getMscorePath();
  if (saved && validateMscore(saved)) {
    return saved;
  }
  const found = autolocateMscore();
  if (found) {
    setMscorePath(found);
    return found;
  }
  return null;
}

export function registerIpc(): void {
  ipcMain.handle("mscore:get", () => resolveMscorePath());

  ipcMain.handle("mscore:set", (_e, mscorePath: string): SetResult => {
    if (!validateMscore(mscorePath)) {
      return { ok: false, error: "Not a valid MuseScore binary" };
    }
    setMscorePath(mscorePath);
    return { ok: true, path: mscorePath };
  });

  ipcMain.handle("mscore:locate", async (): Promise<SetResult | null> => {
    const res = await dialog.showOpenDialog({
      title: "Locate MuseScore 4",
      properties: ["openFile"],
    });
    const picked = res.filePaths[0];
    if (res.canceled || !picked) {
      return null;
    }
    if (!validateMscore(picked)) {
      return { ok: false, error: "Not a valid MuseScore binary" };
    }
    setMscorePath(picked);
    return { ok: true, path: picked };
  });

  ipcMain.handle("dialog:pickMscz", async (): Promise<string | null> => {
    const res = await dialog.showOpenDialog({
      title: "Choose a MuseScore file",
      properties: ["openFile"],
      filters: [{ name: "MuseScore", extensions: ["mscz"] }],
    });
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });

  ipcMain.handle(
    "dialog:pickExportDirectory",
    async (): Promise<string | null> => {
      const res = await dialog.showOpenDialog({
        title: "Choose export folder",
        properties: ["openDirectory", "createDirectory"],
      });
      return res.canceled ? null : (res.filePaths[0] ?? null);
    },
  );

  ipcMain.handle("score:readMeta", (_e, msczPath: string) => {
    const mscore = resolveMscorePath();
    if (!mscore) {
      throw new Error("MuseScore path not set");
    }
    return readScoreMeta(mscore, expandHome(msczPath));
  });

  ipcMain.handle(
    "score:copyWithMeta",
    (_e, sourcePath: string, destinationPath: string, tags: MetadataTags) =>
      copyMsczWithMeta(
        expandHome(sourcePath),
        expandHome(destinationPath),
        tags,
      ),
  );

  // Returns an outcome rather than rejecting: Electron flattens Error
  // subclasses and rewrites their message, so a thrown code cannot be
  // recovered on the renderer side.
  ipcMain.handle(
    "score:runExport",
    (_e, options: Omit<RunExportOptions, "mscorePath">) => {
      try {
        const mscorePath = resolveMscorePath();
        if (!mscorePath) {
          throw new ExportError(
            "EXPORT_MSCORE_NOT_SET",
            "MuseScore path not set",
          );
        }
        return {
          ok: true as const,
          value: exportScoreFolder({
            ...options,
            mscorePath,
            msczPath: expandHome(options.msczPath),
            destinationDirectory: expandHome(options.destinationDirectory),
          }),
        };
      } catch (error) {
        return toExportFailure(error);
      }
    },
  );

  ipcMain.handle("shell:openFolder", (_e, folderPath: string) =>
    shell.openPath(expandHome(folderPath)),
  );
}
