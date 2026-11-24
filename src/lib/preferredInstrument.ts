import { compareInstrumentOrder, zInstrument, type Instrument } from "../../types/instrument";

// The instrument a reader last chose. The songbook reader opens on it, and the
// Biblioteca's "Instrumento" menu sets it.
export const INSTRUMENT_KEY = "cadernin:instrumento";

/** "sax alto" → "Sax alto". */
export const instrumentLabel = (instrument: string) =>
  instrument.charAt(0).toUpperCase() + instrument.slice(1);

const selectedInstrument = (instrument: string | null) => instrument?.replace(/ pirata$/, "") ?? null;

/** The instrument selected in Partes, without the separate pirata setting. */
export const partInstrumentLabel = (instrument: string) =>
  instrumentLabel((selectedInstrument(instrument) ?? "").replace(/ eb$/, " Eb"));

export function comparePartsByInstrument(a: { instrument: string | null }, b: { instrument: string | null }): number {
  return compareInstrumentOrder(selectedInstrument(a.instrument), selectedInstrument(b.instrument));
}

/** Number repeated instruments so the visible tabs remain distinguishable. */
export function partInstrumentLabels<T extends { instrument: string | null }>(parts: readonly T[]): Map<T, string> {
  const counts = new Map<string, number>();
  const labels = parts.map((part) => partInstrumentLabel(part.instrument ?? ""));
  for (const label of labels) {counts.set(label, (counts.get(label) ?? 0) + 1);}
  const seen = new Map<string, number>();
  return new Map(parts.map((part, index) => {
    const label = labels[index];
    const position = (seen.get(label) ?? 0) + 1;
    seen.set(label, position);
    return [part, (counts.get(label) ?? 0) > 1 ? `${label} ${position}` : label];
  }));
}

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
