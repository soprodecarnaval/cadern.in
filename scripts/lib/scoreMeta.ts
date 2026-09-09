import { execFileSync } from "child_process";
import fs from "fs";
import type { Instrument } from "../../types/instrument";
import { mapInstrumentId } from "./scoreInstrument";
import { withIsolatedMscoreEnvironment } from "./mscoreEnvironment";

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

export const readScoreMeta = (
  mscore: string,
  msczPath: string,
): ScoreMeta => {
  // MuseScore SIGABRTs (rather than erroring cleanly) when given a path that
  // does not exist, so guard here.
  if (!fs.existsSync(msczPath)) {
    throw new Error(`File not found: ${msczPath}`);
  }
  // MuseScore 4 SIGABRTs reading MuseScore 3 files headless. Catch the crash
  // and surface an actionable message instead of the raw abort dump.
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
    const err = e as { signal?: string; stderr?: string };
    const crashed =
      err.signal === "SIGABRT" ||
      (err.stderr ?? "").includes("mutex lock failed");
    if (crashed) {
      throw new Error(
        "Could not read this score. If it was made in MuseScore 3, open it " +
          "in MuseScore 4 and save it again, then retry.",
      );
    }
    throw new Error("MuseScore failed to read this score's metadata.");
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
