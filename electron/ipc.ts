import { ipcMain, dialog } from "electron";
import os from "node:os";
import path from "node:path";
import { autolocateMscore, validateMscore } from "../scripts/lib/mscz";
import { listParts } from "../scripts/lib/scoreMeta";
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

  ipcMain.handle("score:listParts", (_e, msczPath: string) => {
    const mscore = resolveMscorePath();
    if (!mscore) {
      throw new Error("MuseScore path not set");
    }
    return listParts(mscore, expandHome(msczPath));
  });
}
