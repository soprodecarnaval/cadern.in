// Fingering text for one note, per notation (ticket 008):
// - positions (default): 1–7. Trombone uses its slide tables (or the dynamic
//   picker); valve instruments map their valve combination to a position.
//   A 4-valve tuba's notes below position 7 are written as valves.
// - valves: 3 valves for every part (trombone: the trumpet table an octave
//   down, as a valve trombone), or 4 valves for tuba.
import {
  TUBA_3V_LOWEST,
  TUBA_4V_VALVES,
  VALVE_POSITIONS,
  newTrombonePicker,
  valveText,
} from "./fingerings";
import type { Instrument } from "../../../types/instrument";
import type { InstrumentSettings } from "./index";

export type FingeringNotation = {
  notation: "positions" | "valves";
  /** Tuba only; ignored for other instruments. */
  valveCount: 3 | 4;
  /** Trombone in positions mode only. */
  dynamicTrombone: boolean;
};

export const DEFAULT_NOTATION: FingeringNotation = Object.freeze({
  notation: "positions",
  valveCount: 3,
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
  const fourValves = tables.family === "tuba" && options.valveCount === 4;
  const valves = (index: number) =>
    valveText(fourValves ? TUBA_4V_VALVES : tables.valves, index + tables.valveIndexOffset);
  if (options.notation === "valves") {
    return (sounding) => valves(sounding + shift);
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
    if (fourValves && index < TUBA_3V_LOWEST) {return valves(index);}
    const combination = valveText(tables.valves, index);
    return combination ? String(VALVE_POSITIONS[combination]) : "";
  };
}

/** Whether `valveCount` applies to the instrument (tuba only). */
export const hasValveCountOption = (settings: InstrumentSettings | null) =>
  settings?.fingering?.family === "tuba";

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
