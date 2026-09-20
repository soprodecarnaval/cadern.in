import z from "zod";
import type { Instrument } from "../../types/instrument";
import { zMetajson, type Metajson } from "../../types/metajson";
import { parseInstrument } from "../instrument";
import type { Warning } from "../result";

interface FileDraft {
  name: string;
  instrument: Instrument;
  svg: { page: number; file: File }[];
  midiFile?: File;
}

export interface ParsedPart {
  /** Display name. Authored in MuseScore; arbitrary. */
  name: string;
  /**
   * File stem. Keys `fileMap` and, downstream, Storage paths — so it must stay
   * filesystem-safe even when `name` is not.
   */
  basename: string;
  instrument: Instrument;
  svg: string[];
  midi: string;
}

export interface ParsedScore {
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  parts: ParsedPart[];
  fileMap: Map<string, File>;
  warnings: Warning[];
}

interface MetajsonFields {
  composer: string;
  sub: string;
  tags: string[];
}

interface ReadMetajson {
  fields: MetajsonFields;
  /** Present only for v2 sidecars; pre-v2 leaves parts to be inferred. */
  manifest: Metajson | null;
}

const metajsonFields = (data: {
  composer?: string;
  previousSource?: string;
  poet?: string;
}): MetajsonFields => ({
  composer: data.composer ?? "",
  sub: data.previousSource ?? "",
  tags: data.poet?.split(",").map((t: string) => t.trim()) ?? [],
});

async function readMetajson(file: File): Promise<ReadMetajson | null> {
  try {
    const data = JSON.parse(await file.text()) as Record<string, unknown>;
    // Keyed on the version literal, not on the presence of `parts`: MuseScore
    // writes its own metajson with a differently-shaped `parts` array.
    const parsed = zMetajson.safeParse(data);
    return {
      fields: metajsonFields(data),
      manifest: parsed.success ? parsed.data : null,
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

export async function parseUploadedFiles(files: File[]): Promise<ParsedScore> {
  const warnings: Warning[] = [];
  const fileMap = new Map<string, File>();

  let title = "";
  let meta: MetajsonFields = { composer: "", sub: "", tags: [] };
  let manifest: Metajson | null = null;
  let msczFile: File | undefined;
  const partDrafts = new Map<string, FileDraft>();

  // Determine song title from the mscz filename
  const msczFiles = files.filter((f) => f.name.endsWith(".mscz"));
  if (msczFiles.length === 1) {
    msczFile = msczFiles[0];
    title = removeExtension(msczFile.name);
  } else if (msczFiles.length > 1) {
    warnings.push({
      code: "MULTIPLE_MSCZ",
      meta: { files: msczFiles.map((f) => f.name) },
    });
    msczFile = msczFiles[0];
    title = removeExtension(msczFile.name);
  } else {
    warnings.push({ code: "NO_MSCZ", meta: {} });
  }
  if (msczFile) {
    fileMap.set("mscz", msczFile);
  }

  // Read the sidecar before anything else: a v2 manifest replaces filename
  // inference entirely, so the inference pass must not run and warn first.
  const metajsonFile = files.find((f) => f.name.endsWith(".metajson"));
  if (metajsonFile) {
    const parsed = await readMetajson(metajsonFile);
    if (parsed) {
      meta = parsed.fields;
      manifest = parsed.manifest;
      fileMap.set("metajson", metajsonFile);
    } else {
      warnings.push({
        code: "METAJSON_PARSE_FAILED",
        meta: { file: metajsonFile.name },
      });
    }
  }

  if (manifest) {
    return buildFromManifest(files, manifest, meta, title, fileMap, warnings);
  }
  warnings.push({ code: "METAJSON_LEGACY", meta: {} });

  for (const file of files) {
    const ext = getExtension(file.name);
    const basename = removeExtension(file.name);

    if (ext === ".metajson") {
      continue;
    }

    if (ext === ".mscz") {
      continue;
    }

    if (ext !== ".svg" && ext !== ".midi") {
      continue;
    }

    // Parse instrument from filename (remove song title first)
    const withoutTitle = basename.replace(title, "");
    const instrument = parseInstrument(withoutTitle);

    if (!instrument) {
      if (ext === ".midi" && !fileMap.has("midi")) {
        fileMap.set("midi", file);
      } else {
        warnings.push({
          code: "INSTRUMENT_NOT_DETECTED",
          meta: { file: file.name },
        });
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

  // Pre-v2: part names and instruments are inferred from filenames.
  const parts: ParsedPart[] = [];
  for (const [, draft] of partDrafts) {
    draft.svg.sort((a, b) => a.page - b.page);
    const svgPaths = draft.svg.map((s) => `parts/${draft.name}-${s.page}.svg`);
    const midiPath = `parts/${draft.name}.midi`;

    if (svgPaths.length === 0) {
      warnings.push({ code: "PART_NO_SVG", meta: { partName: draft.name } });
    }
    if (!draft.midiFile) {
      warnings.push({ code: "PART_NO_MIDI", meta: { partName: draft.name } });
    }

    parts.push({
      name: draft.name,
      basename: draft.name,
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

/**
 * v2: the sidecar lists every file by name, so nothing is inferred. Storage keys
 * are still derived from the part's stem and page index rather than the supplied
 * filenames, keeping them stable and identical to what pre-v2 produced.
 */
function buildFromManifest(
  files: File[],
  manifest: Metajson,
  meta: MetajsonFields,
  title: string,
  fileMap: Map<string, File>,
  warnings: Warning[],
): ParsedScore {
  const byName = new Map(files.map((file) => [file.name, file]));
  const claimed = new Set<string>();
  const parts: ParsedPart[] = [];

  for (const part of manifest.parts) {
    const basename = part.midi.replace(/\.midi$/, "");

    const midiFile = byName.get(part.midi);
    if (midiFile) {
      claimed.add(part.midi);
      fileMap.set(`parts/${basename}.midi`, midiFile);
    } else {
      warnings.push({ code: "PART_NO_MIDI", meta: { partName: part.name } });
    }

    const svgKeys = part.svg.map((filename, index) => {
      const key = `parts/${basename}-${index + 1}.svg`;
      const file = byName.get(filename);
      if (file) {
        claimed.add(filename);
        fileMap.set(key, file);
      } else {
        warnings.push({ code: "METAJSON_FILE_MISSING", meta: { file: filename } });
      }
      return key;
    });
    if (svgKeys.length === 0) {
      warnings.push({ code: "PART_NO_SVG", meta: { partName: part.name } });
    }

    parts.push({
      name: part.name,
      basename,
      instrument: part.instrument,
      svg: svgKeys,
      midi: `parts/${basename}.midi`,
    });
  }

  // The full-score midi is the one no part claimed.
  const scoreMidi = files.find(
    (file) => file.name.endsWith(".midi") && !claimed.has(file.name),
  );
  if (scoreMidi) {
    fileMap.set("midi", scoreMidi);
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
  parts: z.array(
    z.object({
      name: z.string().min(1),
      basename: z.string().min(1),
      instrument: z.string(),
      svg: z.array(z.string()),
      midi: z.string(),
    }),
  ),
});

export function validateParsedScore(parsed: ParsedScore): Warning[] {
  const result = zParsedScoreValidation.safeParse({
    title: parsed.title,
    composer: parsed.composer,
    sub: parsed.sub,
    tags: parsed.tags,
    parts: parsed.parts,
  });
  if (result.success) {
    return [];
  }

  return result.error.errors.map((e) => ({
    code: "VALIDATION_ERROR" as const,
    meta: { path: e.path.join("."), zodMessage: e.message },
  }));
}
