import { zInstrument, type Instrument } from "../../types/instrument";

// The instrument a reader last chose. The songbook reader opens on it, and the
// Biblioteca's "Instrumento" menu sets it.
export const INSTRUMENT_KEY = "cadernin:instrumento";

/** "sax alto" → "Sax alto". */
export const instrumentLabel = (instrument: string) =>
  instrument.charAt(0).toUpperCase() + instrument.slice(1);

export function readPreferredInstrument(): Instrument | null {
  try {
    const parsed = zInstrument.safeParse(localStorage.getItem(INSTRUMENT_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function storePreferredInstrument(instrument: Instrument) {
  try {
    localStorage.setItem(INSTRUMENT_KEY, instrument);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}
