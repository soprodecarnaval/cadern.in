import z from "zod";
import type { Instrument } from "../../types/instrument";
import { zPartData, type PartData } from "../../types/docs";
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
  parts: PartData[];
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
    warnings.push({ code: "MULTIPLE_MSCZ", meta: { files: msczFiles.map((f) => f.name) } });
    msczFile = msczFiles[0];
    title = removeExtension(msczFile.name);
  } else {
    warnings.push({ code: "NO_MSCZ", meta: {} });
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
        warnings.push({ code: "METAJSON_PARSE_FAILED", meta: { file: file.name } });
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
      if (ext === ".midi" && !fileMap.has("midi")) {
        fileMap.set("midi", file);
      } else {
        warnings.push({ code: "INSTRUMENT_NOT_DETECTED", meta: { file: file.name } });
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
  const parts: PartData[] = [];
  for (const [, draft] of partDrafts) {
    draft.svg.sort((a, b) => a.page - b.page);
    const svgPaths = draft.svg.map(
      (s) => `parts/${draft.name}-${s.page}.svg`,
    );
    const midiPath = `parts/${draft.name}.midi`;

    if (svgPaths.length === 0) {
      warnings.push({ code: "PART_NO_SVG", meta: { partName: draft.name } });
    }
    if (!draft.midiFile) {
      warnings.push({ code: "PART_NO_MIDI", meta: { partName: draft.name } });
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

const zParsedScoreValidation = z.object({
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
  parts: z.array(zPartData),
});

export function validateParsedScore(parsed: ParsedScore): Warning[] {
  const result = zParsedScoreValidation.safeParse({
    title: parsed.title,
    composer: parsed.composer,
    sub: parsed.sub,
    tags: parsed.tags,
    parts: parsed.parts,
  });
  if (result.success) return [];

  return result.error.errors.map((e) => ({
    code: "VALIDATION_ERROR" as const,
    meta: { path: e.path.join("."), zodMessage: e.message },
  }));
}
