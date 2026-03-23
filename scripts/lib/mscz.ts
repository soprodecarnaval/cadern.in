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

const findLooseMsczFiles = (projectPath: string): string[] => {
  return fs
    .readdirSync(projectPath)
    .filter((e) => e.endsWith(".mscz"))
    .map((e) => path.join(projectPath, e));
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

const moveLooseMsczToFolder = (msczPath: string, projectPath: string): string => {
  const fileName = path.basename(msczPath);
  const songName = fileName.replace(/\.mscz$/, "");
  const destDir = path.join(projectPath, songName);
  fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(msczPath, path.join(destDir, fileName));
  console.log(`Moved: ${fileName} -> ${songName}/${fileName}`);
  return destDir;
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

const listScoreFolders = (projectPath: string): string[] => {
  return fs
    .readdirSync(projectPath)
    .map((e) => path.join(projectPath, e))
    .filter((p) => fs.statSync(p).isDirectory())
    .filter((p) => findMsczInFolder(p) !== undefined);
};

const listProjectFolders = (collectionPath: string): string[] => {
  return fs
    .readdirSync(collectionPath)
    .map((e) => path.join(collectionPath, e))
    .filter((p) => fs.statSync(p).isDirectory())
    .filter((p) => listScoreFolders(p).length > 0);
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

export const exportProjectAssets = (
  mscore: string,
  projectPath: string,
  opts: ExportOptions
): void => {
  const looseMsczFiles = findLooseMsczFiles(projectPath);
  if (looseMsczFiles.length > 0) {
    console.log(`Found ${looseMsczFiles.length} loose mscz files, moving to folders...`);
    for (const msczFile of looseMsczFiles) {
      moveLooseMsczToFolder(msczFile, projectPath);
    }
  }
  const scoreFolders = listScoreFolders(projectPath);
  console.log(`Found ${scoreFolders.length} scores in project: ${path.basename(projectPath)}`);
  let exported = 0;
  let skipped = 0;
  for (const scoreFolder of scoreFolders) {
    if (exportScoreAssets(mscore, scoreFolder, opts)) {
      exported++;
    } else {
      skipped++;
    }
  }
  console.log(`Exported: ${exported}, Skipped: ${skipped}`);
};

export const exportCollectionAssets = (
  mscore: string,
  collectionPath: string,
  opts: ExportOptions
): void => {
  const projectFolders = listProjectFolders(collectionPath);
  console.log(`Found ${projectFolders.length} projects in collection`);
  for (const projectFolder of projectFolders) {
    console.log(`\n=== Project: ${path.basename(projectFolder)} ===`);
    exportProjectAssets(mscore, projectFolder, opts);
  }
};
