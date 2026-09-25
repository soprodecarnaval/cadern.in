import fs from "node:fs";
import path from "node:path";
import { inferParts } from "./inferParts";
import { partNameFromStem } from "./partNames";
import { METAJSON_VERSION, type Metajson } from "../../types/metajson";
import { translateWarning } from "../../src/lib/warningMessages";

/** Reads a directory as the uploader would see it. */
export function readFolder(folder: string): File[] {
  return fs
    .readdirSync(folder)
    .filter((name) => fs.statSync(path.join(folder, name)).isFile())
    .map((name) => new File([fs.readFileSync(path.join(folder, name))], name));
}

const removeExtension = (filename: string): string => {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
};

/** Pre-v2 sidecars hold only these three fields; the rest was in the filenames. */
function readLegacyFields(folder: string): {
  composer: string;
  previousSource: string;
  poet: string;
} {
  const name = fs.readdirSync(folder).find((f) => f.endsWith(".metajson"));
  if (!name) {
    return { composer: "", previousSource: "", poet: "" };
  }
  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(folder, name), "utf8"),
    ) as Record<string, string | undefined>;
    return {
      composer: data.composer ?? "",
      previousSource: data.previousSource ?? "",
      poet: data.poet ?? "",
    };
  } catch {
    return { composer: "", previousSource: "", poet: "" };
  }
}

export interface BackfillResult {
  metajson: Metajson;
  /** Filename-inference complaints, already translated for display. */
  warnings: string[];
}

/**
 * Upgrades an exported folder's sidecar to v2.
 *
 * The website no longer infers anything from filenames, so this is the only
 * remaining path for a folder exported before the manifest existed. Anything
 * the inference cannot work out is reported rather than guessed at.
 */
export function buildMetajson(folder: string): BackfillResult {
  const files = readFolder(folder);

  const mscz = files.find((f) => f.name.endsWith(".mscz"));
  if (!mscz) {
    throw new Error("No .mscz found — is this an exported score folder?");
  }
  const title = removeExtension(mscz.name);

  const inferred = inferParts(files, title);
  if (inferred.parts.length === 0) {
    throw new Error("No parts found — is this an exported score folder?");
  }

  const legacy = readLegacyFields(folder);

  return {
    metajson: {
      version: METAJSON_VERSION,
      ...legacy,
      parts: inferred.parts.map((part) => ({
        // Match the Firestore backfill, so a re-upload agrees with migrated data.
        name: partNameFromStem(part.name, title),
        instrument: part.instrument,
        svg: part.svg.map((f) => f.name),
        midi: part.midi?.name ?? `${part.name}.midi`,
      })),
    },
    warnings: inferred.warnings.map((w) => translateWarning(w.code, w.meta)),
  };
}
