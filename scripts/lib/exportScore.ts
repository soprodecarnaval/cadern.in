import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Instrument } from "../../types/instrument";
import {
  isMscoreMutexCrash,
  withIsolatedMscoreEnvironment,
} from "./mscoreEnvironment";
import { copyMsczWithMeta, type MetadataTags } from "./msczMeta";

export interface SelectedPart {
  id: string;
  name: string;
  scoreIndex: number;
  instrument: Instrument;
}

export interface RunExportOptions {
  mscorePath: string;
  msczPath: string;
  title: string;
  selectedParts: SelectedPart[];
  metadata: MetadataTags;
  destinationDirectory: string;
}

export interface ExportResult {
  directory: string;
  files: string[];
}

interface SplitParts {
  parts: string[];
  partsBin: string[];
}

const parseJsonOutput = <T>(stdout: string): T => {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Unexpected MuseScore output (no JSON found)");
  }
  return JSON.parse(stdout.slice(start, end + 1)) as T;
};

const splitScoreParts = (mscorePath: string, msczPath: string): SplitParts => {
  let stdout: string;
  try {
    stdout = withIsolatedMscoreEnvironment((env) =>
      execFileSync(mscorePath, ["-F", "--score-parts", msczPath], {
        encoding: "utf8",
        env,
        maxBuffer: 256 * 1024 * 1024,
      }),
    );
  } catch (error) {
    const processStdout = (error as { stdout?: string | Buffer }).stdout;
    stdout = Buffer.isBuffer(processStdout)
      ? processStdout.toString("utf8")
      : (processStdout ?? "");
  }
  const result = parseJsonOutput<SplitParts>(stdout);
  if (
    !Array.isArray(result.parts) ||
    !Array.isArray(result.partsBin) ||
    result.parts.length !== result.partsBin.length
  ) {
    throw new Error("Unexpected MuseScore parts output");
  }
  return result;
};

export const safeFilename = (value: string): string => {
  const withoutControlCharacters = Array.from(value, (character) =>
    character.charCodeAt(0) < 32 ? "-" : character,
  ).join("");
  const safe = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/[ .]+$/g, "")
    .trim();
  return safe || "partitura";
};

export const buildPartBasenames = (
  title: string,
  parts: SelectedPart[],
): Map<string, string> => {
  const totals = new Map<Instrument, number>();
  const seen = new Map<Instrument, number>();
  for (const part of parts) {
    totals.set(part.instrument, (totals.get(part.instrument) ?? 0) + 1);
  }

  return new Map(
    parts.map((part) => {
      const occurrence = (seen.get(part.instrument) ?? 0) + 1;
      seen.set(part.instrument, occurrence);
      const suffix =
        (totals.get(part.instrument) ?? 0) > 1
          ? `-${String.fromCharCode(96 + occurrence)}`
          : "";
      return [
        part.id,
        `${safeFilename(title)}-${safeFilename(part.instrument)}${suffix}`,
      ];
    }),
  );
};

const runConversionJob = (
  mscorePath: string,
  jobPath: string,
): void => {
  try {
    execFileSync(mscorePath, ["-F", "-j", jobPath], {
      stdio: "pipe",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    if (!isMscoreMutexCrash(error)) {
      throw error;
    }
  }
};

const assertGeneratedAssets = (
  directory: string,
  title: string,
  partBasenames: string[],
): void => {
  const files = fs.readdirSync(directory);
  const requiredMidi = [title, ...partBasenames].map((name) => `${name}.midi`);
  const missingMidi = requiredMidi.filter((name) => !files.includes(name));
  const missingSvg = partBasenames.filter(
    (basename) =>
      !files.some(
        (name) =>
          name === `${basename}.svg` ||
          (name.startsWith(`${basename}-`) && name.endsWith(".svg")),
      ),
  );
  if (missingMidi.length > 0 || missingSvg.length > 0) {
    throw new Error(
      `MuseScore did not generate: ${[...missingMidi, ...missingSvg].join(", ")}. ` +
        `Generated files: ${files.join(", ") || "none"}`,
    );
  }
};

const normalizeGeneratedFilenames = (directory: string): void => {
  for (const name of fs.readdirSync(directory)) {
    const normalized = name.normalize("NFC");
    if (normalized !== name) {
      fs.renameSync(path.join(directory, name), path.join(directory, normalized));
    }
  }
};

export const exportScoreFolder = (options: RunExportOptions): ExportResult => {
  if (options.selectedParts.length === 0) {
    throw new Error("Select at least one compatible part");
  }
  if (!fs.statSync(options.destinationDirectory).isDirectory()) {
    throw new Error("Export destination is not a directory");
  }

  const stagingDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cadernin-export-"),
  );
  const copiedFiles: string[] = [];
  try {
    const title = safeFilename(options.title);
    const scorePath = path.join(stagingDirectory, `${title}.mscz`);
    copyMsczWithMeta(options.msczPath, scorePath, options.metadata);

    const split = splitScoreParts(options.mscorePath, scorePath);
    const selectedInScoreOrder = [...options.selectedParts].sort(
      (left, right) => left.scoreIndex - right.scoreIndex,
    );
    if (
      selectedInScoreOrder.some(
        (part) => split.parts[part.scoreIndex] !== part.name,
      )
    ) {
      throw new Error("Selected parts no longer match the score");
    }

    const basenames = buildPartBasenames(
      title,
      selectedInScoreOrder,
    );
    const job: Array<{ in: string; out: string | string[] }> = [
      { in: scorePath, out: path.join(stagingDirectory, `${title}.midi`) },
    ];

    for (const part of selectedInScoreOrder) {
      const partPath = path.join(
        stagingDirectory,
        `part-${part.scoreIndex}.mscz`,
      );
      fs.writeFileSync(
        partPath,
        Buffer.from(split.partsBin[part.scoreIndex], "base64"),
      );
      const basename = basenames.get(part.id)!;
      job.push({
        in: partPath,
        out: [
          path.join(stagingDirectory, `${basename}.svg`),
          path.join(stagingDirectory, `${basename}.midi`),
        ],
      });
    }

    const jobPath = path.join(stagingDirectory, "job.json");
    fs.writeFileSync(jobPath, JSON.stringify(job));
    runConversionJob(options.mscorePath, jobPath);
    normalizeGeneratedFilenames(stagingDirectory);
    assertGeneratedAssets(
      stagingDirectory,
      title,
      selectedInScoreOrder.map((part) => basenames.get(part.id)!),
    );
    fs.writeFileSync(
      path.join(stagingDirectory, `${title}.metajson`),
      JSON.stringify(
        {
          composer: options.metadata.composer,
          previousSource: options.metadata.previousSource,
          poet: options.metadata.poet,
        },
        null,
        2,
      ),
    );

    const generatedFiles = fs
      .readdirSync(stagingDirectory)
      .filter((name) =>
        [".mscz", ".svg", ".midi", ".metajson"].includes(path.extname(name)),
      )
      .filter((name) => !name.startsWith("part-"))
      .sort();
    for (const name of generatedFiles) {
      const destination = path.join(options.destinationDirectory, name);
      fs.copyFileSync(
        path.join(stagingDirectory, name),
        destination,
        fs.constants.COPYFILE_EXCL,
      );
      copiedFiles.push(destination);
    }

    return {
      directory: options.destinationDirectory,
      files: generatedFiles,
    };
  } catch (error) {
    for (const file of copiedFiles) {
      fs.unlinkSync(file);
    }
    throw error;
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
};
