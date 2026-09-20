import type { Instrument } from "../../types/instrument";
import { parseInstrument } from "../../src/instrument";
import type { Warning } from "../../src/result";

/**
 * Reconstructs a score's parts from filenames alone, the way uploads worked
 * before metajson v2 carried an explicit manifest.
 *
 * This is offline tooling now: the website refuses pre-v2 folders, and the only
 * remaining job is upgrading one in place via scripts/backfillMetajson.ts.
 * Nothing new should be built on filename inference.
 */

export interface InferredPart {
  /** Filename stem; pre-v2 this served as both the name and the storage key. */
  name: string;
  instrument: Instrument;
  /** Page files in reading order. */
  svg: File[];
  midi: File | undefined;
}

export interface InferredScore {
  parts: InferredPart[];
  /** The .midi belonging to the whole score rather than a part. */
  scoreMidi: File | undefined;
  warnings: Warning[];
}

interface Draft {
  name: string;
  instrument: Instrument;
  svg: { page: number; file: File }[];
  midi?: File;
}

function removeExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
}

function getExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx > 0 ? filename.substring(dotIdx) : "";
}

/** `name-3.svg` is page 3 of `name`; an unsuffixed file is page 1. */
function extractPageNumber(basename: string): { name: string; page: number } {
  const match = basename.match(/^(.+)-(\d+)$/);
  if (match) {
    return { name: match[1], page: parseInt(match[2], 10) };
  }
  return { name: basename, page: 1 };
}

export function inferParts(files: File[], title: string): InferredScore {
  const warnings: Warning[] = [];
  const drafts = new Map<string, Draft>();
  let scoreMidi: File | undefined;

  for (const file of files) {
    const ext = getExtension(file.name);
    const basename = removeExtension(file.name);
    if (ext !== ".svg" && ext !== ".midi") {
      continue;
    }

    // The title is stripped first so it cannot itself match an instrument.
    const instrument = parseInstrument(basename.replace(title, ""));
    if (!instrument) {
      if (ext === ".midi" && !scoreMidi) {
        scoreMidi = file;
      } else {
        warnings.push({
          code: "INSTRUMENT_NOT_DETECTED",
          meta: { file: file.name },
        });
      }
      continue;
    }

    const { name, page } =
      ext === ".svg"
        ? extractPageNumber(basename)
        : { name: basename, page: 1 };

    const draft = drafts.get(name) ?? { name, instrument, svg: [] };
    drafts.set(name, draft);
    if (ext === ".svg") {
      draft.svg.push({ page, file });
    } else {
      draft.midi = file;
    }
  }

  const parts: InferredPart[] = [];
  for (const draft of drafts.values()) {
    draft.svg.sort((a, b) => a.page - b.page);
    if (draft.svg.length === 0) {
      warnings.push({ code: "PART_NO_SVG", meta: { partName: draft.name } });
    }
    if (!draft.midi) {
      warnings.push({ code: "PART_NO_MIDI", meta: { partName: draft.name } });
    }
    parts.push({
      name: draft.name,
      instrument: draft.instrument,
      svg: draft.svg.map((s) => s.file),
      midi: draft.midi,
    });
  }

  return { parts, scoreMidi, warnings };
}
