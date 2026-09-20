import fs from "node:fs";
import path from "node:path";
import { parseUploadedFiles } from "../../src/lib/parseUploadedFiles";
import { partNameFromStem } from "./partNames";
import { METAJSON_VERSION, type Metajson } from "../../types/metajson";

/** Reads a directory as the uploader would see it. */
export function readFolder(folder: string): File[] {
  return fs
    .readdirSync(folder)
    .filter((name) => fs.statSync(path.join(folder, name)).isFile())
    .map((name) => new File([fs.readFileSync(path.join(folder, name))], name));
}

/**
 * Upgrades an exported folder's sidecar to v2.
 *
 * The inference rules are not reimplemented: the folder is handed to the same
 * parseUploadedFiles the uploader uses, and its pre-v2 path does the work. When
 * that path is removed (milestone 010 phase D), the logic has to move here.
 */
export async function buildMetajson(folder: string): Promise<Metajson> {
  const parsed = await parseUploadedFiles(readFolder(folder));

  if (parsed.parts.length === 0) {
    throw new Error("No parts found — is this an exported score folder?");
  }

  const filename = (key: string): string => {
    const file = parsed.fileMap.get(key);
    if (!file) {
      throw new Error(`Parsed key has no file behind it: ${key}`);
    }
    return file.name;
  };

  return {
    version: METAJSON_VERSION,
    composer: parsed.composer,
    previousSource: parsed.sub,
    // readMetajson splits poet on commas into tags; this is the inverse.
    poet: parsed.tags.join(", "),
    parts: parsed.parts.map((part) => ({
      // Match the Firestore backfill, so a re-upload agrees with migrated data.
      name: partNameFromStem(part.name, parsed.title),
      instrument: part.instrument,
      svg: part.svg.map(filename),
      midi: filename(part.midi),
    })),
  };
}
