import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

interface Settings {
  mscorePath?: string;
}

const settingsFile = (): string =>
  path.join(app.getPath("userData"), "export-app-settings.json");

const read = (): Settings => {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf-8")) as Settings;
  } catch {
    return {};
  }
};

const write = (settings: Settings): void => {
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
};

export const getMscorePath = (): string | undefined => read().mscorePath;

export const setMscorePath = (mscorePath: string): void => {
  const settings = read();
  settings.mscorePath = mscorePath;
  write(settings);
};
