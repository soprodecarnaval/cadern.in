// Geometry of src/assets/brand/spiral-loop.svg (viewBox "-5.14 0 30.28 61.99"):
// one tile is 30.28 wide and 61.99 tall, and the loop's ring spans x 0–20,
// so 5.14–25.14 from the tile's left edge.
const TILE_WIDTH = 30.28;
const TILE_HEIGHT = 61.99;
const LOOP_START = 5.14;
const LOOP_WIDTH = 20;

/** How far left of a loop the cut goes, so no sliver of it shows. */
const CLEARANCE = 1;

/**
 * Where, at or before `x`, a spiral can be cut without splitting a loop.
 *
 * The spiral is drawn as a CSS background with `space` repeat: tiles scaled
 * to the spiral's height, as many whole ones as fit, the leftover width
 * spread evenly between them. All values are in px from the spiral's left
 * edge.
 */
export function safeSpiralCut(
  x: number,
  spiralWidth: number,
  spiralHeight: number,
): number {
  const scale = spiralHeight / TILE_HEIGHT;
  const tile = TILE_WIDTH * scale;
  const count = Math.floor(spiralWidth / tile + 1e-6);
  if (count < 1) {
    return x;
  }
  const spread = count > 1 ? (spiralWidth - count * tile) / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const start = i * (tile + spread) + LOOP_START * scale;
    const end = start + LOOP_WIDTH * scale;
    if (x > start - CLEARANCE && x < end) {
      return Math.max(0, start - CLEARANCE);
    }
  }
  return x;
}
