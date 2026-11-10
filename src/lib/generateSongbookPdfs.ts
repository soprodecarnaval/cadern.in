import type { Instrument } from "../../types/instrument";
import { createSongBook } from "../createSongBook";
import { instrumentFallbacks, type Section } from "./pdfGeneration";

export interface GenerateSongbookPdfsOptions {
  sections: Section[];
  instruments: Instrument[];
  title: string;
  covers: Partial<Record<Instrument, string>>;
  fallbackInstruments: Set<Instrument>;
  carnivalMode: boolean;
  backSheetPageNumber: boolean;
  antiAssedioPages: boolean;
  debugBoundingBoxes?: boolean;
  onStart?: (instrument: Instrument) => void;
  onComplete?: (instrument: Instrument, index: number, total: number) => void;
}

/** Runs createSongBook once per instrument, in order, reporting progress. */
export async function generateSongbookPdfs({
  sections,
  instruments,
  title,
  covers,
  fallbackInstruments,
  carnivalMode,
  backSheetPageNumber,
  antiAssedioPages,
  debugBoundingBoxes,
  onStart,
  onComplete,
}: GenerateSongbookPdfsOptions): Promise<void> {
  for (let i = 0; i < instruments.length; i++) {
    const instrument = instruments[i];
    onStart?.(instrument);

    await createSongBook({
      instrument,
      fallbackInstrument: fallbackInstruments.has(instrument)
        ? instrumentFallbacks[instrument]
        : undefined,
      sections,
      title,
      coverImageUrl: covers[instrument] || "",
      carnivalMode,
      backSheetPageNumber,
      antiAssedioPages,
      debugBoundingBoxes,
    });

    onComplete?.(instrument, i, instruments.length);
  }
}
