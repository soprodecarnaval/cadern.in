import { Instrument, Part, zScore } from "../../types";
import { parseInstrument } from "../instrument";
import type { Warning } from "../result";

interface FileDraft {
  name: string;
  instrument: Instrument;
  svg: { page: number; file: File }[];
  midiFile?: File;
}

export interface ParsedScore {
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  parts: Part[];
  fileMap: Map<string, File>;
  warnings: Warning[];
}

interface MetajsonFields {
  composer: string;
  sub: string;
  tags: string[];
}

async function readMetajson(file: File): Promise<MetajsonFields | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    return {
      composer: data.composer ?? "",
      sub: data.previousSource ?? "",
      tags: data.poet?.split(",").map((t: string) => t.trim()) ?? [],
    };
  } catch {
    return null;
  }
}

function extractPageNumber(basename: string): { name: string; page: number } {
  const match = basename.match(/^(.+)-(\d+)$/);
  if (match) {
    return { name: match[1], page: parseInt(match[2], 10) };
  }
  return { name: basename, page: 1 };
}

function removeExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
}

function getExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx > 0 ? filename.substring(dotIdx) : "";
}

export async function parseUploadedFiles(
  files: File[],
): Promise<ParsedScore> {
  const warnings: Warning[] = [];
  const fileMap = new Map<string, File>();

  let title = "";
  let meta: MetajsonFields = { composer: "", sub: "", tags: [] };
  let msczFile: File | undefined;
  const partDrafts = new Map<string, FileDraft>();

  // Determine song title from the mscz filename
  const msczFiles = files.filter((f) => f.name.endsWith(".mscz"));
  if (msczFiles.length === 1) {
    msczFile = msczFiles[0];
    title = removeExtension(msczFile.name);
  } else if (msczFiles.length > 1) {
    warnings.push({
      message: "Multiple .mscz files found, using first one",
      meta: { files: msczFiles.map((f) => f.name) },
    });
    msczFile = msczFiles[0];
    title = removeExtension(msczFile.name);
  } else {
    warnings.push({ message: "No .mscz file found", meta: {} });
  }

  for (const file of files) {
    const ext = getExtension(file.name);
    const basename = removeExtension(file.name);

    if (ext === ".metajson") {
      const parsed = await readMetajson(file);
      if (parsed) {
        meta = parsed;
        fileMap.set("metajson", file);
      } else {
        warnings.push({
          message: "Failed to parse metajson",
          meta: { file: file.name },
        });
      }
      continue;
    }

    if (ext === ".mscz") {
      if (file === msczFile) {
        fileMap.set("mscz", file);
      }
      continue;
    }

    if (ext !== ".svg" && ext !== ".midi") continue;

    // Parse instrument from filename (remove song title first)
    const withoutTitle = basename.replace(title, "");
    const instrument = parseInstrument(withoutTitle);

    if (!instrument) {
      warnings.push({
        message: `Could not detect instrument in filename`,
        meta: { file: file.name },
      });
      if (ext === ".midi" && !fileMap.has("midi")) {
        // Score-level midi (no instrument in name)
        fileMap.set("midi", file);
      }
      continue;
    }

    if (ext === ".svg") {
      const { name: partName, page } = extractPageNumber(basename);
      if (!partDrafts.has(partName)) {
        partDrafts.set(partName, {
          name: partName,
          instrument,
          svg: [],
        });
      }
      const draft = partDrafts.get(partName)!;
      draft.svg.push({ page, file });
      const svgKey = `parts/${partName}-${page}.svg`;
      fileMap.set(svgKey, file);
    } else if (ext === ".midi") {
      const partName = basename;
      if (!partDrafts.has(partName)) {
        partDrafts.set(partName, {
          name: partName,
          instrument,
          svg: [],
        });
      }
      partDrafts.get(partName)!.midiFile = file;
      fileMap.set(`parts/${partName}.midi`, file);
    }
  }

  // Build parts array
  const parts: Part[] = [];
  for (const [, draft] of partDrafts) {
    draft.svg.sort((a, b) => a.page - b.page);
    const svgPaths = draft.svg.map(
      (s) => `parts/${draft.name}-${s.page}.svg`,
    );
    const midiPath = `parts/${draft.name}.midi`;

    if (svgPaths.length === 0) {
      warnings.push({
        message: `Part "${draft.name}" has no SVG files`,
        meta: {},
      });
    }
    if (!draft.midiFile) {
      warnings.push({
        message: `Part "${draft.name}" has no MIDI file`,
        meta: {},
      });
    }

    parts.push({
      name: draft.name,
      instrument: draft.instrument,
      svg: svgPaths,
      midi: midiPath,
    });
  }

  return {
    title,
    composer: meta.composer,
    sub: meta.sub,
    tags: meta.tags,
    parts,
    fileMap,
    warnings,
  };
}

export function validateParsedScore(parsed: ParsedScore): Warning[] {
  const draft = {
    id: "validation-draft",
    title: parsed.title,
    composer: parsed.composer,
    sub: parsed.sub,
    mscz: "placeholder",
    metajson: "placeholder",
    midi: "placeholder",
    parts: parsed.parts,
    tags: parsed.tags,
    projectTitle: "placeholder",
  };

  const result = zScore.safeParse(draft);
  if (result.success) return [];

  return result.error.errors.map((e) => ({
    message: `Validation: ${e.path.join(".")} - ${e.message}`,
    meta: { path: e.path.join("."), code: e.code },
  }));
}
