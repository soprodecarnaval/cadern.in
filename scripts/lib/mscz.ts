import fs from "fs";
import { execSync } from "child_process";

// MuseScore 4 only.
const knownMscorePaths = (): string[] => {
  switch (process.platform) {
    case "darwin":
      return ["/Applications/MuseScore 4.app/Contents/MacOS/mscore"];
    case "win32":
      return [
        "C:\\Program Files\\MuseScore 4\\bin\\MuseScore4.exe",
        "C:\\Program Files (x86)\\MuseScore 4\\bin\\MuseScore4.exe",
      ];
    default:
      return [
        "/usr/bin/mscore4",
        "/usr/local/bin/mscore4",
        "/usr/bin/mscore",
        "/var/lib/flatpak/exports/bin/org.musescore.MuseScore",
      ];
  }
};

const pathNames = (): string[] =>
  process.platform === "win32"
    ? ["MuseScore4.exe", "mscore4"]
    : ["mscore4", "mscore"];

const whichCmd = process.platform === "win32" ? "where" : "command -v";

// Non-throwing: returns a path to MuseScore 4, or undefined.
export const autolocateMscore = (): string | undefined => {
  for (const name of pathNames()) {
    try {
      const out = execSync(`${whichCmd} ${name}`, {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
      const first = out.split(/\r?\n/)[0]?.trim();
      if (first) {
        return first;
      }
    } catch {
      // not on PATH; try next
    }
  }
  for (const candidate of knownMscorePaths()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

// True if the binary runs `--version` without error.
export const validateMscore = (mscorePath: string): boolean => {
  try {
    execSync(`"${mscorePath}" --version`, {
      stdio: "ignore",
      timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
};
