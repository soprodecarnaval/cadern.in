import type { SongbookItemViewModel } from "../../types/viewModels";

export interface SongbookEditorItem {
  id: string;
  item: SongbookItemViewModel;
}

export function identifySongbookItems(
  rows: SongbookItemViewModel[],
  sectionIds: WeakMap<SongbookItemViewModel, string>,
  createId: () => string = () => crypto.randomUUID(),
): SongbookEditorItem[] {
  return rows.map((item) => {
    if (item.type === "score") {
      return { id: `score:${item.score.id}`, item };
    }
    let id = sectionIds.get(item);
    if (!id) {
      id = `section:${createId()}`;
      sectionIds.set(item, id);
    }
    return { id, item };
  });
}

export function reorderSongbookItems<T>(rows: T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 ||
      from >= rows.length || to >= rows.length || from === to) {
    return rows;
  }
  const result = [...rows];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

export function insertionIndex(from: number, target: number, edge: "before" | "after"): number {
  const boundary = target + (edge === "after" ? 1 : 0);
  return boundary > from ? boundary - 1 : boundary;
}

export interface SongbookDragRange {
  start: number;
  end: number;
}

export function songbookDragRange(rows: SongbookItemViewModel[], from: number): SongbookDragRange | null {
  if (!Number.isInteger(from) || from < 0 || from >= rows.length) { return null; }
  let end = from + 1;
  if (rows[from].type === "section") {
    while (end < rows.length && rows[end].type !== "section") { end++; }
  }
  return { start: from, end };
}

export function songbookSectionRange(rows: SongbookItemViewModel[], index: number): SongbookDragRange | null {
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) { return null; }
  let start = index;
  while (start > 0 && rows[start].type !== "section") { start--; }
  let end = start + 1;
  while (end < rows.length && rows[end].type !== "section") { end++; }
  return { start, end };
}

/** Destination is a boundary in the original list, before removal. */
export function moveSongbookEntry(
  rows: SongbookItemViewModel[], from: number, boundary: number,
): SongbookItemViewModel[] {
  const range = songbookDragRange(rows, from);
  if (!range || !Number.isInteger(boundary) || boundary < 0 || boundary > rows.length ||
    (boundary >= range.start && boundary <= range.end)) { return rows; }
  if (rows[from].type !== "section") {
    return reorderSongbookItems(rows, from, boundary > from ? boundary - 1 : boundary);
  }
  // A section must not split another section or absorb the unsectioned prefix.
  if (boundary < rows.length && rows[boundary].type !== "section") { return rows; }
  const moved = rows.slice(range.start, range.end);
  const remaining = [...rows.slice(0, range.start), ...rows.slice(range.end)];
  const destination = boundary > range.end ? boundary - moved.length : boundary;
  remaining.splice(destination, 0, ...moved);
  return remaining;
}
