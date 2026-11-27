import type { CursorSystem, CursorTarget } from "../../../lib/browserScore/playbackCursor";

/**
 * A drawn page's staff systems and notes, in the score frame's pixels.
 * Measures are numbered in reading order from 0 on each page.
 */
export interface PageCursorGeometry {
  systems: CursorSystem[];
  targets: Map<string, CursorTarget>;
  measures: number;
}

/** Read systems and note positions from a Verovio page drawn in a ScoreSvgFrame. */
export function measureCursorGeometry(doc: Document): PageCursorGeometry {
  const systems: CursorSystem[] = [];
  const targets = new Map<string, CursorTarget>();
  let measures = 0;
  doc.querySelectorAll("g.system").forEach((system) => {
    // Verovio draws the five staff lines as the staff's direct <path> children.
    const lines = [...system.querySelectorAll("g.staff > path")].map((line) => line.getBoundingClientRect());
    if (!lines.length) {return;}
    const index = systems.length;
    const box = system.getBoundingClientRect();
    const top = Math.min(...lines.map((line) => line.top));
    const bottom = Math.max(...lines.map((line) => line.bottom));
    // The band reaches a little past the staff, for notes on ledger lines.
    const reach = (bottom - top) / 4 * 1.5;
    systems.push({ left: box.left, right: box.right, top: top - reach, bottom: bottom + reach });
    for (const measure of system.querySelectorAll("g.measure")) {
      // The measure's own barline is its right edge; a measure without one ends where its drawing does.
      const barLine = [...measure.children].find((child) => child.classList.contains("barLine"));
      const measureEnd = (barLine ?? measure).getBoundingClientRect().right;
      const number = measures++;
      measure.querySelectorAll("g.note[id], g.rest[id], g.mRest[id], g.multiRest[id]").forEach((element) => {
        const rect = (element.querySelector(".notehead") ?? element).getBoundingClientRect();
        targets.set(element.id, { x: rect.left + rect.width / 2, system: index, measure: number, measureEnd });
      });
    }
  });
  return { systems, targets, measures };
}
