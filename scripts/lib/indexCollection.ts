import fs from "fs";
import path from "path";

import { Collection, Instrument, Project, Score, zScore } from "../../types";
import { Ok, Result, Warning, err, ok, warning } from "../../src/result";
import { parseInstrument } from "../../src/instrument";

interface ScoreDirectory {
  absPath: string;
  songTitle: string;
  projectTitle: string;
}

const listScoreDirectories = (inputDir: string): ScoreDirectory[] => {
  const result: ScoreDirectory[] = [];
  for (const projectTitle of fs.readdirSync(inputDir)) {
    const projectDir = path.join(inputDir, projectTitle);
    if (fs.statSync(projectDir).isDirectory()) {
      for (const songTitle of fs.readdirSync(projectDir)) {
        const scoreDir = path.join(projectDir, songTitle);
        if (fs.statSync(scoreDir).isDirectory()) {
          result.push({ absPath: scoreDir, songTitle, projectTitle });
        }
      }
    }
  }
  return result;
};

const parseInstrumentInEntry = (
  songDirectory: ScoreDirectory,
  entry: string,
  ext: string
): Instrument | undefined => {
  const basename = path.basename(entry, ext);
  const withoutSongTitle = basename.replace(songDirectory.songTitle, "");
  return parseInstrument(withoutSongTitle);
};

const scrapeMediaAsset = (
  draft: any,
  songDirectory: ScoreDirectory,
  entry: string,
  ext: string
): Result<void> => {
  const instrument = parseInstrumentInEntry(songDirectory, entry, ext);
  const entryPath = path.join(songDirectory.absPath, entry);
  const field = ext.replace(".", "");
  if (instrument) {
    let name = path.basename(entry, ext);
    let pageNumber: number | undefined;

    if (ext === ".svg" && name.match(/-\d+$/)) {
      const match = name.match(/-(\d+)$/);
      if (match) {
        pageNumber = parseInt(match[1], 10);
        name = name.replace(/-\d+$/, "");
      }
    }

    if (!name || name.trim() === "") {
      return err(warning(`Part name is empty`, { entryPath, songDirectory }));
    }

    let partIdx = draft.parts.findIndex((p: any) => p.name === name);
    if (partIdx === -1) {
      draft.parts.push({ name, instrument, svg: [] });
      partIdx = draft.parts.length - 1;
    }

    if (!draft.parts[partIdx].svg) {
      draft.parts[partIdx].svg = [];
    }

    if (ext === ".svg") {
      draft.parts[partIdx].svg.push({ page: pageNumber ?? 1, path: entryPath });
    } else {
      draft.parts[partIdx][field] = entryPath;
    }
  } else {
    draft[field] = entryPath;
  }
  return ok(undefined);
};

const normalizeSongTitle = (songTitle: string): string =>
  songTitle.toLowerCase().replace(/_/g, " ");

function readJsonFile(absPath: string): Result<any> {
  if (!fs.existsSync(absPath)) {
    return err(warning(`No json file found`, { absPath }));
  }
  try {
    return ok(JSON.parse(fs.readFileSync(absPath, "utf-8")));
  } catch {
    return err(warning(`Invalid json file`, { absPath }));
  }
}

type MetajsonSongFields = {
  composer: string;
  sub: string;
  metajson: string;
  tags?: string[];
};

function scrapeMetaJson(
  scoreDirectory: ScoreDirectory,
  entry: string
): MetajsonSongFields | {} {
  const metajson = path.join(scoreDirectory.absPath, entry);
  const readResult = readJsonFile(metajson);
  if (!readResult.ok) return {};
  const { composer, previousSource, poet } = readResult.value;
  return {
    composer,
    sub: previousSource,
    metajson,
    tags: poet?.split(",").map((t: string) => t.trim()) ?? [],
  };
}

const indexScore = (
  scoreDirectory: ScoreDirectory,
  previousCollection?: Collection
): Result<Score> => {
  let draft: any = {
    id: path.join(scoreDirectory.projectTitle, scoreDirectory.songTitle),
    title: normalizeSongTitle(scoreDirectory.songTitle),
    parts: [],
    tags: [],
    projectTitle: scoreDirectory.projectTitle,
  };

  const scrapeAssetErrors = [];
  for (const entry of fs.readdirSync(scoreDirectory.absPath)) {
    const ext = path.extname(entry);
    if (ext === ".metajson") {
      draft = { ...draft, ...scrapeMetaJson(scoreDirectory, entry) };
    } else if (ext === ".midi" || ext === ".svg" || ext === ".mscz") {
      const result = scrapeMediaAsset(draft, scoreDirectory, entry, ext);
      if (!result.ok) scrapeAssetErrors.push(...result.warnings);
    }
  }

  for (const part of draft.parts) {
    if (part.svg && Array.isArray(part.svg)) {
      part.svg.sort((a: any, b: any) => a.page - b.page);
      part.svg = part.svg.map((p: any) => p.path);
    }
  }

  if (draft.tags.length === 0 && previousCollection) {
    const previousSong = previousCollection.projects
      .find((p) => p.title === draft.projectTitle)
      ?.scores.find((s) => s.title === draft.title);
    if (previousSong) draft.tags = previousSong.tags;
  }

  const result = zScore.safeParse(draft);
  if (result.success) return ok(result.data, scrapeAssetErrors);
  return err(
    warning("Invalid song", {
      errors: result.error.errors.map((e) => ({ ...e, path: e.path.join(".") })),
      songDirectory: scoreDirectory,
    })
  );
};

const indexProjects = (
  songDirectories: ScoreDirectory[],
  previousCollection?: Collection
): Ok<Project[]> => {
  const projects: Project[] = [];
  const warnings: Warning[] = [];
  for (const songDirectory of songDirectories) {
    const songResult = indexScore(songDirectory, previousCollection);
    if (songResult.ok) {
      const score = songResult.value;
      const projectIdx = projects.findIndex((p) => p.title === songDirectory.projectTitle);
      if (projectIdx === -1) {
        projects.push({ title: songDirectory.projectTitle, scores: [score] });
      } else {
        projects[projectIdx].scores.push(score);
      }
    }
    warnings.push(...songResult.warnings);
  }
  return ok(projects, warnings);
};

function copyAsset<K extends string>(
  obj: Record<K, string>,
  key: K,
  inputPath: string,
  outputPath: string
): Result<void> {
  const inputAbsPath = obj[key];
  if (inputAbsPath) {
    const relPath = path.relative(inputPath, inputAbsPath);
    const outputAbsPath = path.join(outputPath, relPath);
    fs.mkdirSync(path.dirname(outputAbsPath), { recursive: true });
    fs.copyFileSync(inputAbsPath, outputAbsPath);
    obj[key] = relPath;
  }
  return ok(undefined);
}

function copySongAssets(song: Score, inputPath: string, outputPath: string): Result<void> {
  const warnings: Warning[] = [];
  for (const asset of ["mscz" as const, "metajson" as const, "midi" as const]) {
    const result = copyAsset(song, asset, inputPath, outputPath);
    if (!result.ok) warnings.push(...result.warnings);
  }
  for (const part of song.parts) {
    const midiResult = copyAsset(part, "midi", inputPath, outputPath);
    if (!midiResult.ok) warnings.push(...midiResult.warnings);
    for (let i = 0; i < part.svg.length; i++) {
      const inputAbsPath = part.svg[i];
      if (inputAbsPath) {
        const relPath = path.relative(inputPath, inputAbsPath);
        const outputAbsPath = path.join(outputPath, relPath);
        fs.mkdirSync(path.dirname(outputAbsPath), { recursive: true });
        fs.copyFileSync(inputAbsPath, outputAbsPath);
        part.svg[i] = relPath;
      }
    }
  }
  return ok(undefined, warnings);
}

function writeCollection(
  projects: Project[],
  inputDir: string,
  outputDir: string
): Ok<Collection> {
  const collection: Collection = { projects, version: 3 };
  const warnings: Warning[] = [];
  for (const project of projects) {
    for (const song of project.scores) {
      copySongAssets(song, inputDir, outputDir);
    }
  }
  fs.writeFileSync(
    path.join(outputDir, "collection.json"),
    JSON.stringify(collection, null, 2)
  );
  return ok(collection, warnings);
}

/**
 * Scans a collection directory, validates and copies assets to outputDir,
 * and writes collection.json. Returns any warnings encountered.
 */
export function indexCollection(
  inputDir: string,
  outputDir: string,
  previousCollection?: Collection
): Warning[] {
  const scoreDirectories = listScoreDirectories(inputDir);
  const { value: projects, warnings: indexWarnings } = indexProjects(
    scoreDirectories,
    previousCollection
  );
  const { warnings: writeWarnings } = writeCollection(projects, inputDir, outputDir);
  return [...indexWarnings, ...writeWarnings];
}
