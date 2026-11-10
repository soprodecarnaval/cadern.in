import type { SongbookItemViewModel } from "../../types/viewModels";
import type { SongbookEditorItem } from "./songbookReorder";
import { songbookSectionRange } from "./songbookReorder";

export type DndGroup = "available" | "songbook";

/** Droppable id for the songbook column's empty-list placeholder row. */
export const SONGBOOK_APPEND_ID = "songbook-append";

/**
 * Where an incoming score (not yet in `rows`) should land, given the entry
 * it was dropped on/near. Mirrors SongbookSortableList's destination()
 * section/score edge-to-index branching, without the from/carried-range
 * exclusion — the incoming score isn't part of `rows` yet.
 */
export function destinationForIncomingScore(
  rows: SongbookItemViewModel[],
  entries: SongbookEditorItem[],
  targetId: string | number | undefined,
  edge: "before" | "after",
): number {
  if (targetId === undefined || targetId === SONGBOOK_APPEND_ID) {
    return rows.length;
  }
  const to = entries.findIndex((entry) => entry.id === targetId);
  if (to < 0) {
    return rows.length;
  }
  if (rows[to].type === "section") {
    const group = songbookSectionRange(rows, to)!;
    return edge === "after" ? group.end : group.start;
  }
  return edge === "after" ? to + 1 : to;
}
