import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface ExportOptions {
  force: boolean;
}

export const detectMscore = (): string => {
  try {
    execSync("which mscore", { stdio: "ignore" });
    return "mscore";
  } catch {
    const macPath = "/Applications/MuseScore 3.app/Contents/MacOS/mscore";
    if (process.platform === "darwin" && fs.existsSync(macPath)) {
      return macPath;
    }
    throw new Error("mscore not found. Install MuseScore or add it to PATH.");
  }
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

