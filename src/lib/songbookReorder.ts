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
