// Fingering text for one note, per notation (ticket 008):
// - positions (default): 1–7. Trombone uses its slide tables (or the dynamic
//   picker); valve instruments map their valve combination to a position.
// - valves: 3 valves for every part (trombone: the trumpet table an octave
//   down, as a valve trombone).
// Tuba notes below the 3-valve range: positions continue past 7 (8 to 12, a
// semitone each); in valves notation they are 4-valve pistons (14, 124, 234,
// 134, 1234).
import {
  TUBA_3V_LOWEST,
  TUBA_LOW_VALVES,
  VALVE_POSITIONS,
  newTrombonePicker,
  valveText,
} from "./fingerings";
import type { Instrument } from "../../../types/instrument";
import type { InstrumentSettings } from "./index";

export type FingeringNotation = {
  notation: "positions" | "valves";
  /** Trombone in positions mode only. */
  dynamicTrombone: boolean;
};

export const DEFAULT_NOTATION: FingeringNotation = Object.freeze({
  notation: "positions",
  dynamicTrombone: false,
});

/**
 * A function from sounding MIDI pitch to fingering text ("" when the pitch has
 * none), or null when the instrument has no fingerings. Make one per staff:
 * the dynamic trombone picker remembers the previous position.
 */
export function fingeringFunction(
  settings: InstrumentSettings | null,
  options: FingeringNotation = DEFAULT_NOTATION,
): ((sounding: number) => string) | null {
  const tables = settings?.fingering;
  if (!settings || !tables) {return null;}
  const shift = settings.transpositionForTable;
  // Below the tuba's 3-valve range: 4-valve pistons, whatever the notation.
  const low = (index: number) =>
    tables.family === "tuba" && index < TUBA_3V_LOWEST ? valveText(TUBA_LOW_VALVES, index) : null;
  if (options.notation === "valves") {
    return (sounding) => low(sounding + shift) ?? valveText(tables.valves, sounding + shift + tables.valveIndexOffset);
  }
  if (tables.slide) {
    if (options.dynamicTrombone) {
      const pick = newTrombonePicker(tables.slide.alternatives);
      return (sounding) => pick(sounding + shift);
    }
    const positions = tables.slide.positions;
    return (sounding) => String(positions[sounding + shift] ?? "");
  }
  return (sounding) => {
    const index = sounding + shift;
    // Tuba notes below position 7 continue the count, a semitone per position (8, 9, … 12),
    // where the table has a 4-valve fingering for them.
    if (low(index) !== null) {return low(index) ? String(7 + TUBA_3V_LOWEST - index) : "";}
    const combination = valveText(tables.valves, index);
    return combination ? String(VALVE_POSITIONS[combination]) : "";
  };
}

/**
 * The instrument a part is filed under: a fingered trumpet or trombone part is
 * a pirata ("trompete pirata", "trombone pirata"), and back when fingerings are
 * off. Tuba and bombardino have no pirata entry and keep their instrument.
 */
export function pirataInstrument(instrument: Instrument, fingered: boolean): Instrument {
  const base = instrument.replace(/ pirata$/, "") as Instrument;
  if (!fingered) {return base;}
  return base === "trompete" ? "trompete pirata" : base === "trombone" ? "trombone pirata" : base;
}
