// Pitch → fingering tables, ported from plugin/fingerings.js.
//
// Every table is indexed by a C-instrument pitch: the sounding MIDI pitch plus
// the instrument's `transpositionForTable` (instrumentSettings). Valve
// combinations are written together, lowest valve first ("12", "123"), as the
// plugin writes them today.

/** Table index → valve combination ("0" is open). */
export type ValveTable = Readonly<Record<number, string>>;
/** Table index → slide position (1–7). */
export type SlideTable = Readonly<Record<number, number>>;
/** Table index → slide positions, the plain one first and alternatives after. */
export type SlideAlternatives = Readonly<Record<number, readonly number[]>>;

const table = (first: number, values: readonly string[]): ValveTable =>
  Object.freeze(
    Object.fromEntries(values.map((value, i) => [first + i, value])),
  );

/** griff_trumpet: a C trumpet; Bb trumpets add 2 to the sounding pitch. */
export const TRUMPET_VALVES = table(54, [
  "123", "13", "23", "12", "1", "2", "0", // 54–60
  "123", "13", "23", "12", "1", "2", "0", // 61–67
  "23", "12", "1", "2", "0", // 68–72
  "12", "1", "2", "0", // 73–76
  "1", "2", "0", // 77–79
  "23", "12", "1", "2", "0", // 80–84
  "2", "1", // 85–86
]);

/** griff_tuba: a C tuba; Bb tubas add 2, Eb tubas subtract 3. */
export const TUBA_VALVES = table(30, [
  "123", "13", "23", "12", "1", "2", "0", // 30–36
  "123", "13", "23", "12", "1", "2", "0", // 37–43
  "23", "12", "1", "2", "0", // 44–48
  "12", "1", "2", "0", // 49–52
  "1", "2", "0", // 53–55
  "23", "12", "1", "2", "0", // 56–60
  "2", "1", // 61–62
]);

/**
 * griff_tuba_4v: a 4-valve tuba on the same C-indexed basis as TUBA_VALVES. The 4th valve lowers by
 * a perfect fourth: "4" replaces 1-3 and "24" replaces 1-2-3, and 14, 124, 234, 134 and 1234 extend
 * the range below the 3-valve table. Pending a brass player's review (ticket 008).
 */
export const TUBA_4V_VALVES: ValveTable = Object.freeze({
  ...table(25, ["1234", "134", "234", "124", "14"]), // 25–29
  ...TUBA_VALVES,
  30: "24", 31: "4", 37: "24", 38: "4",
});

/** Lowest index of the 3-valve tuba table; 4-valve notes below it have no slide-style position. */
export const TUBA_3V_LOWEST = 30;

/** Each 3-valve combination's position: every step lowers the pitch a semitone. */
export const VALVE_POSITIONS: Readonly<Record<string, number>> = Object.freeze({
  "0": 1, "2": 2, "1": 3, "12": 4, "23": 5, "13": 6, "123": 7,
});

/** griff_euphonium: the tuba table an octave up. */
export const EUPHONIUM_VALVES = table(42, [
  "123", "13", "23", "12", "1", "2", "0", // 42–48
  "123", "13", "23", "12", "1", "2", "0", // 49–55
  "23", "12", "1", "2", "0", // 56–60
  "12", "1", "2", "0", // 61–64
  "1", "2", "0", // 65–67
  "23", "12", "1", "2", "0", // 68–72
  "2", "1", // 73–74
]);

/** griff_trombone: one slide position per pitch. */
export const TROMBONE_POSITIONS: SlideTable = Object.freeze({
  43: 6, 44: 5, 45: 4, 46: 3, 47: 2, 48: 1, 49: 7,
  50: 6, 51: 5, 52: 4, 53: 3, 54: 2, 55: 1, 56: 5,
  57: 4, 58: 3, 59: 2, 60: 1, 61: 4, 62: 3, 63: 2,
  64: 1, 65: 3, 66: 2, 67: 1, 68: 3, 69: 2, 70: 3,
  71: 1,
});

/** trombonePositions: the positions the dynamic trombone picker chooses from. */
export const TROMBONE_ALTERNATIVES: SlideAlternatives = Object.freeze({
  43: [6], 44: [5], 45: [4], 46: [3], 47: [2], 48: [1], 49: [7],
  50: [6], 51: [5], 52: [4], 53: [3], 54: [2, 7], 55: [1, 6],
  56: [5], 57: [4], 58: [3, 7], 59: [2, 6], 60: [1, 5], 61: [4, 7],
  62: [3, 6], 63: [2, 5], 64: [1, 4], 65: [3], 66: [2, 7], 67: [1, 6],
  68: [5, 7], 69: [4, 6], 70: [3, 5, 7], 71: [2, 4, 6], 72: [1, 3, 5],
  73: [2, 4, 7], 74: [1, 3, 6], 75: [2, 5], 76: [1, 4],
});

/** A valve combination as text; `breakLine` stacks the valves one per line. */
export const valveText = (
  valves: ValveTable,
  index: number,
  breakLine = false,
): string => {
  const combination = valves[index] ?? "";
  return breakLine ? combination.split("").join("\n") : combination;
};

/**
 * newTrombonePicker: picks among alternative positions, staying close to the
 * previous one. Position 7 is used only straight after 6. One picker per staff.
 */
export const newTrombonePicker = (
  alternatives: SlideAlternatives = TROMBONE_ALTERNATIVES,
) => {
  let previous: number | null = null;
  return (index: number): string => {
    const options = alternatives[index];
    if (!options) {return "";}
    if (options.length === 1) {
      previous = options[0];
      return String(previous);
    }
    let candidates = options.slice();
    if (previous !== 6) {
      candidates = candidates.filter((position) => position !== 7);
      if (candidates.length === 0) {candidates = options.slice();}
    }
    let choice = candidates[0];
    if (previous !== null) {
      for (const candidate of candidates.slice(1)) {
        if (Math.abs(candidate - previous) < Math.abs(choice - previous))
          {choice = candidate;}
      }
    }
    previous = choice;
    return String(choice);
  };
};
