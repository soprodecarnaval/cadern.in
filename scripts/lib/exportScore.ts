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
import { assertSupportedMscz } from "./msczArchive";
import { ExportError } from "./exportError";
import {
  METAJSON_VERSION,
  type Metajson,
  type MetajsonPart,
} from "../../types/metajson";

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
  /** Replace files already in the destination instead of refusing. */
  overwrite?: boolean;
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
  const missing = [...missingMidi, ...missingSvg];
  if (missing.length > 0) {
    throw new ExportError(
      "EXPORT_ASSETS_MISSING",
      `MuseScore did not generate: ${missing.join(", ")}. ` +
        `Generated files: ${files.join(", ") || "none"}`,
      { missing },
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

const svgPageNumber = (filename: string, basename: string): number => {
  // `basename.svg` is a single-page part; `basename-N.svg` is page N.
  const suffix = filename.slice(basename.length, -".svg".length);
  const page = Number.parseInt(suffix.replace(/^-/, ""), 10);
  return Number.isNaN(page) ? 1 : page;
};

const isSvgPageOf = (filename: string, basename: string): boolean =>
  filename.endsWith(".svg") &&
  (filename === `${basename}.svg` || filename.startsWith(`${basename}-`));

/**
 * Lists a part's generated files in reading order. Sorted numerically, because
 * a lexical sort puts page 10 before page 2.
 */
export const collectPartFiles = (
  files: string[],
  basename: string,
): Pick<MetajsonPart, "svg" | "midi"> => ({
  svg: files
    .filter((name) => isSvgPageOf(name, basename))
    .sort(
      (left, right) =>
        svgPageNumber(left, basename) - svgPageNumber(right, basename),
    ),
  midi: `${basename}.midi`,
});

export const exportScoreFolder = (options: RunExportOptions): ExportResult => {
  if (options.selectedParts.length === 0) {
    throw new ExportError(
      "EXPORT_NO_PARTS",
      "Select at least one compatible part",
    );
  }
  assertSupportedMscz(options.msczPath);
  if (
    !fs.existsSync(options.destinationDirectory) ||
    !fs.statSync(options.destinationDirectory).isDirectory()
  ) {
    throw new ExportError(
      "EXPORT_DESTINATION_NOT_DIRECTORY",
      "Export destination is not a directory",
      { path: options.destinationDirectory },
    );
  }

  const stagingDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cadernin-export-"),
  );
  const copiedFiles: string[] = [];
  const title = safeFilename(options.title);
  const exportDirectory = path.join(options.destinationDirectory, title);
  let createdExportDirectory = false;
  try {
    if (fs.existsSync(exportDirectory) && !fs.statSync(exportDirectory).isDirectory()) {
      throw new ExportError(
        "EXPORT_DESTINATION_NOT_DIRECTORY",
        "Export destination is not a directory",
        { path: exportDirectory },
      );
    }
    const scorePath = path.join(stagingDirectory, `${title}.mscz`);
    copyMsczWithMeta(options.msczPath, scorePath, options.metadata);

    const split = splitScoreParts(options.mscorePath, scorePath);
    const selectedInScoreOrder = [...options.selectedParts].sort(
      (left, right) => left.scoreIndex - right.scoreIndex,
    );
    // Guard against the file changing between reading its metadata and
    // exporting. Names cannot be compared here: --score-meta reports an
    // instrument's long name ("Eufônio B♭ (concerto)") while --score-parts
    // reports the part name ("Bombardino"), and they differ for most parts.
    if (
      selectedInScoreOrder.some(
        (part) =>
          part.scoreIndex < 0 || part.scoreIndex >= split.parts.length,
      )
    ) {
      throw new ExportError(
        "EXPORT_SCORE_CHANGED",
        "Selected parts no longer match the score",
      );
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
    const generatedNames = fs.readdirSync(stagingDirectory);
    const metajson: Metajson = {
      version: METAJSON_VERSION,
      composer: options.metadata.composer,
      previousSource: options.metadata.previousSource,
      poet: options.metadata.poet,
      // The part name, as MuseScore titles the generated part — that is what
      // is printed on the musician's sheet. Carried verbatim; filenames are
      // only transport.
      parts: selectedInScoreOrder.map((part) => ({
        name: split.parts[part.scoreIndex],
        instrument: part.instrument,
        ...collectPartFiles(generatedNames, basenames.get(part.id)!),
      })),
    };
    fs.writeFileSync(
      path.join(stagingDirectory, `${title}.metajson`),
      JSON.stringify(metajson, null, 2),
    );

    const generatedFiles = fs
      .readdirSync(stagingDirectory)
      .filter((name) =>
        [".mscz", ".svg", ".midi", ".metajson"].includes(path.extname(name)),
      )
      .filter((name) => !name.startsWith("part-"))
      .sort();
    // Checked before copying anything: failing partway would leave the
    // destination holding half an export.
    const conflicts = generatedFiles.filter((name) =>
      fs.existsSync(path.join(exportDirectory, name)),
    );
    if (conflicts.length > 0 && !options.overwrite) {
      throw new ExportError(
        "EXPORT_DESTINATION_NOT_EMPTY",
        `Destination already has: ${conflicts.join(", ")}`,
        { files: conflicts, directory: exportDirectory },
      );
    }

    if (!fs.existsSync(exportDirectory)) {
      fs.mkdirSync(exportDirectory);
      createdExportDirectory = true;
    }
    for (const name of generatedFiles) {
      const destination = path.join(exportDirectory, name);
      const replacing = conflicts.includes(name);
      fs.copyFileSync(
        path.join(stagingDirectory, name),
        destination,
        replacing ? 0 : fs.constants.COPYFILE_EXCL,
      );
      // Only roll back files we created. Removing one we overwrote would
      // destroy the user's previous export instead of restoring it.
      if (!replacing) {
        copiedFiles.push(destination);
      }
    }

    return {
      directory: exportDirectory,
      files: generatedFiles,
    };
  } catch (error) {
    for (const file of copiedFiles) {
      fs.unlinkSync(file);
    }
    if (createdExportDirectory && fs.readdirSync(exportDirectory).length === 0) {
      fs.rmdirSync(exportDirectory);
    }
    throw error;
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
};
