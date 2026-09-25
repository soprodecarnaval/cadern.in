import fs from "node:fs";
import AdmZip from "adm-zip";
import { ExportError } from "./exportError";

// A .mscz is a zip. META-INF/container.xml lists every packaged file as a
// <rootfile full-path="..."/>, including the score itself, whose name tracks the
// document name (teste.mscx, sample.mscx) and so cannot be hardcoded.
//
// MuseScore stores each generated part as its own .mscx under Excerpts/, so a
// score with parts saved contains many .mscx entries. Only the one outside
// Excerpts/ is the full score.
const EXCERPT_PREFIX = "Excerpts/";

const isScoreEntry = (entryName: string): boolean =>
  entryName.endsWith(".mscx") && !entryName.startsWith(EXCERPT_PREFIX);

const rootfilePaths = (zip: AdmZip): string[] => {
  const container = zip.getEntry("META-INF/container.xml");
  if (!container) {
    return [];
  }
  const xml = container.getData().toString("utf8");
  return Array.from(
    xml.matchAll(/<rootfile\s+full-path="([^"]+)"/g),
    (match) => match[1],
  );
};

export const findRootScoreEntryName = (zip: AdmZip): string => {
  const declared = rootfilePaths(zip).filter(isScoreEntry);
  if (declared.length > 0) {
    return declared[0];
  }
  // No container.xml, or it declared no score: fall back to scanning entries.
  const scanned = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && isScoreEntry(entry.entryName));
  if (scanned.length === 0) {
    throw new Error("Not a MuseScore file: no .mscx found inside the archive");
  }
  return scanned[0].entryName;
};

export const readScoreXml = (zip: AdmZip): { name: string; xml: string } => {
  const name = findRootScoreEntryName(zip);
  const entry = zip.getEntry(name);
  if (!entry) {
    throw new Error(`Archive declares ${name} but does not contain it`);
  }
  return { name, xml: entry.getData().toString("utf8") };
};

export interface MsczVersion {
  /** File-format version, e.g. "4.70". */
  format: string | undefined;
  /** Application that last saved the file, e.g. "4.7.2". */
  program: string | undefined;
}

export const parseMsczVersion = (xml: string): MsczVersion => ({
  format: /<museScore\s+version="([^"]+)"/.exec(xml)?.[1],
  program: /<programVersion>([^<]+)<\/programVersion>/.exec(xml)?.[1],
});

export const readMsczVersion = (msczPath: string): MsczVersion =>
  parseMsczVersion(readScoreXml(new AdmZip(msczPath)).xml);

const majorVersion = (version: string | undefined): number | undefined => {
  const major = Number.parseInt(version?.split(".")[0] ?? "", 10);
  return Number.isNaN(major) ? undefined : major;
};

export const MINIMUM_MSCORE_MAJOR = 4;

/**
 * Reject files MuseScore 4 cannot read headlessly, before invoking it. Running
 * mscore on a MuseScore 3 file SIGABRTs, so the raw failure is unactionable.
 */
export const assertSupportedMscz = (msczPath: string): void => {
  if (!fs.existsSync(msczPath)) {
    throw new ExportError(
      "EXPORT_FILE_NOT_FOUND",
      `File not found: ${msczPath}`,
      { path: msczPath },
    );
  }

  let version: MsczVersion;
  try {
    version = readMsczVersion(msczPath);
  } catch (error) {
    throw new ExportError(
      "EXPORT_NOT_A_SCORE",
      `Could not open this file as a MuseScore score: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { path: msczPath },
    );
  }

  const major = majorVersion(version.program) ?? majorVersion(version.format);
  if (major === undefined) {
    // Unversioned but otherwise well-formed: let MuseScore decide.
    return;
  }
  if (major < MINIMUM_MSCORE_MAJOR) {
    throw new ExportError(
      "EXPORT_UNSUPPORTED_VERSION",
      `This score was saved in MuseScore ${version.program ?? major}. Open it ` +
        `in MuseScore ${MINIMUM_MSCORE_MAJOR} and save it again, then retry.`,
      { version: version.program ?? String(major), minimum: MINIMUM_MSCORE_MAJOR },
    );
  }
};
