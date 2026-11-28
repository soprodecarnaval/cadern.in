import type { SongbookPrintSettings, SongbookRevisionDoc } from "../../types/docs";
import { zInstrument, type Instrument } from "../../types/instrument";
import { instrumentFallbacks, type Section } from "./pdfGeneration";

/** What an older revision without print settings prints with (037). */
export const defaultPrintSettings: SongbookPrintSettings = {
  fallbacks: [],
  backSheetPageNumber: false,
  antiAssedioPages: false,
};

export function printSettingsOf(
  revision: Pick<SongbookRevisionDoc, "print">,
): SongbookPrintSettings {
  return revision.print ?? defaultPrintSettings;
}

/**
 * The saved settings as `generateSongbookPdfs` options (038), for every place
 * that prints: Imprimir and the readers' PDF download.
 */
export function printOptions(revision: Pick<SongbookRevisionDoc, "print">) {
  const print = printSettingsOf(revision);
  return {
    fallbackInstruments: new Set<Instrument>(print.fallbacks),
    backSheetPageNumber: print.backSheetPageNumber,
    antiAssedioPages: print.antiAssedioPages,
  };
}

export interface PrintableInstrument {
  instrument: Instrument;
  // Set when the instrument has no parts of its own and prints its
  // fallback's, so the UI can say "(com trombone)".
  via?: Instrument;
}

/**
 * Instruments a songbook can be printed for: those with parts, plus those
 * with an enabled fallback that has parts. Order follows the instrument list.
 */
export function printableInstruments(
  sections: Section[],
  revision: Pick<SongbookRevisionDoc, "print">,
): PrintableInstrument[] {
  const scores = sections.flatMap((s) => s.scores).filter((s) => !s.deleted);
  const has = (instrument: Instrument) =>
    scores.some(({ revision: r }) => r.parts.some((p) => p.instrument === instrument));
  const enabled = new Set(printSettingsOf(revision).fallbacks);
  return zInstrument.options.flatMap((instrument): PrintableInstrument[] => {
    if (has(instrument)) {
      return [{ instrument }];
    }
    const fallback = instrumentFallbacks[instrument];
    return fallback && enabled.has(instrument) && has(fallback)
      ? [{ instrument, via: fallback }]
      : [];
  });
}

/** Whether two settings are the same, for the dialog's Salvar (037). */
export function samePrintSettings(a: SongbookPrintSettings, b: SongbookPrintSettings): boolean {
  return a.backSheetPageNumber === b.backSheetPageNumber &&
    a.antiAssedioPages === b.antiAssedioPages &&
    a.fallbacks.length === b.fallbacks.length &&
    a.fallbacks.every((f) => b.fallbacks.includes(f));
}
