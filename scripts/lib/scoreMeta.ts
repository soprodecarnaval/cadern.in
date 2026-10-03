import { execFileSync } from "child_process";
import type { Instrument } from "../../types/instrument";
import { mapInstrumentId } from "./scoreInstrument";
import { withIsolatedMscoreEnvironment } from "./mscoreEnvironment";
import { assertSupportedMscz } from "./msczArchive";
import { ExportError } from "./exportError";

export interface ScorePart {
  id: string;
  name: string;
  instrumentId: string;
  instrument: Instrument | undefined;
  hasPitchedStaff: boolean;
}

export interface ScoreMeta {
  title: string;
  composer: string;
  previousSource: string;
  poet: string;
  subtitle: string;
  pages: number;
  parts: ScorePart[];
}

interface RawPart {
  id: string | number;
  name: string;
  instrumentId: string;
  hasPitchedStaff?: string;
}

interface RawMeta {
  title?: string;
  composer?: string;
  previousSource?: string;
  poet?: string;
  subtitle?: string;
  pages?: number | string;
  parts?: RawPart[];
}

// `--score-meta` prints JSON to stdout, wrapped as { "metadata": {...} }.
// Slice from the first "{" to be robust against any leading log noise.
const parseScoreMeta = (stdout: string): RawMeta => {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Unexpected --score-meta output (no JSON found)");
  }
  const parsed = JSON.parse(stdout.slice(start, end + 1)) as {
    metadata?: RawMeta;
  };
  if (!parsed.metadata) {
    throw new Error("Unexpected --score-meta output (no metadata key)");
  }
  return parsed.metadata;
};

export const recoverScoreMetaStdout = (error: unknown): string | undefined => {
  const stdout = (error as { stdout?: string | Buffer }).stdout;
  const value = Buffer.isBuffer(stdout) ? stdout.toString("utf8") : stdout;
  if (!value) {
    return undefined;
  }
  try {
    parseScoreMeta(value);
    return value;
  } catch {
    return undefined;
  }
};

export const readScoreMeta = (
  mscore: string,
  msczPath: string,
): ScoreMeta => {
  // MuseScore SIGABRTs rather than erroring cleanly on a missing path or on a
  // MuseScore 3 file, so both are rejected before it runs.
  assertSupportedMscz(msczPath);

  let stdout: string;
  try {
    stdout = withIsolatedMscoreEnvironment((env) =>
      execFileSync(mscore, ["--score-meta", msczPath], {
        encoding: "utf-8",
        env,
        maxBuffer: 32 * 1024 * 1024,
      }),
    );
  } catch (e) {
    // MuseScore 4 can print valid metadata and then crash on shutdown.
    const recovered = recoverScoreMetaStdout(e);
    if (!recovered) {
      throw new ExportError(
        "EXPORT_METADATA_UNREADABLE",
        "MuseScore failed to read this score's metadata.",
      );
    }
    stdout = recovered;
  }
  const m = parseScoreMeta(stdout);

  const parts: ScorePart[] = (m.parts ?? []).map((p) => ({
    id: String(p.id),
    name: p.name,
    instrumentId: p.instrumentId,
    instrument: mapInstrumentId(p.instrumentId, p.name),
    hasPitchedStaff: p.hasPitchedStaff === "true",
  }));

  return {
    title: m.title ?? "",
    composer: m.composer ?? "",
    previousSource: m.previousSource ?? "",
    poet: m.poet ?? "",
    subtitle: m.subtitle ?? "",
    pages: Number(m.pages) || 0,
    parts,
  };
};

export const listParts = (mscore: string, msczPath: string): ScorePart[] =>
  readScoreMeta(mscore, msczPath).parts;
