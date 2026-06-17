import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface ExportOptions {
  force: boolean;
}

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

export const detectMscore = (): string => {
  const found = autolocateMscore();
  if (found) {
    return found;
  }
  throw new Error(
    "MuseScore 4 not found. Install it or set the path manually."
  );
};

const findMsczInFolder = (folderPath: string): string | undefined => {
  const entries = fs.readdirSync(folderPath);
  const mscz = entries.find((e) => e.endsWith(".mscz"));
  return mscz ? path.join(folderPath, mscz) : undefined;
};

const hasExportedAssets = (folderPath: string): boolean => {
  const entries = fs.readdirSync(folderPath);
  return entries.some((e) => e.endsWith(".svg"));
};

const cleanupExportedAssets = (folderPath: string): void => {
  const assetExtensions = [".svg", ".midi", ".metajson"];
  for (const entry of fs.readdirSync(folderPath)) {
    if (assetExtensions.includes(path.extname(entry))) {
      fs.unlinkSync(path.join(folderPath, entry));
    }
  }
};

export const generateAssets = (mscore: string, msczPath: string): void => {
  const basePath = msczPath.replace(/\.mscz$/, "");
  const job = [
    {
      in: msczPath,
      out: [
        [`${basePath}_`, ".svg"],
        [`${basePath}_`, ".midi"],
        `${basePath}.midi`,
        `${basePath}.metajson`,
      ],
    },
  ];
  const jobPath = "/tmp/media-generation.json";
  fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
  console.log(`Generating assets for: ${path.basename(msczPath)}`);
  execSync(`"${mscore}" -j "${jobPath}"`, { stdio: "inherit" });
};

export const exportScoreAssets = (
  mscore: string,
  folderPath: string,
  opts: ExportOptions
): boolean => {
  const msczPath = findMsczInFolder(folderPath);
  if (!msczPath) {
    throw new Error(`No .mscz file found in: ${folderPath}`);
  }
  const hasAssets = hasExportedAssets(folderPath);
  if (hasAssets && !opts.force) {
    console.log(`Skipping (already exported): ${path.basename(folderPath)}`);
    return false;
  }
  if (hasAssets && opts.force) {
    console.log(`Cleaning up existing assets: ${path.basename(folderPath)}`);
    cleanupExportedAssets(folderPath);
  }
  generateAssets(mscore, msczPath);
  return true;
};

