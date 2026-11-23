export const FINGERING_SIZE = { min: 0.3, max: 2, step: 0.05, default: 0.9 };

export function stepFingeringSize(value: number, direction: -1 | 1): number {
  const { min, max, step } = FINGERING_SIZE;
  if ((direction < 0 && value <= min) || (direction > 0 && value >= max)) {
    return value;
  }
  const next = Number((value + direction * step).toFixed(10));
  return Math.min(max, Math.max(min, next));
}
