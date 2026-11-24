export type SizeRange = { min: number; max: number; step: number; default: number };

/** Fingering text size: Verovio fingeringScale. */
export const FINGERING_SIZE: SizeRange = { min: 0.3, max: 2, step: 0.05, default: 0.9 };
/** Staff space in millimetres (the profile's staffSize). */
export const STAFF_SIZE: SizeRange = { min: 0.8, max: 8, step: 0.05, default: 1.6 };

/** One step up or down within a range, clamped, without floating-point drift. */
export function stepSize(range: SizeRange, value: number, direction: -1 | 1): number {
  const { min, max, step } = range;
  if ((direction < 0 && value <= min) || (direction > 0 && value >= max)) {
    return value;
  }
  const next = Number((value + direction * step).toFixed(10));
  return Math.min(max, Math.max(min, next));
}

export const stepFingeringSize = (value: number, direction: -1 | 1) => stepSize(FINGERING_SIZE, value, direction);
