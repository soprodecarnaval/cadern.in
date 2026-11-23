import { useCallback, useMemo, useRef } from "react";
import type { SongbookItemViewModel } from "../../types/viewModels";
import { identifySongbookItems } from "./songbookReorder";

export function useSongbookEditorItems(rows: SongbookItemViewModel[]) {
  const sectionIds = useRef(new WeakMap<SongbookItemViewModel, string>());
  const entries = useMemo(() => identifySongbookItems(rows, sectionIds.current), [rows]);
  /** Gives an edited section (a new object) the id of the one it replaces, so
   * its row keeps its place, focus and state. */
  const keepSectionId = useCallback((from: SongbookItemViewModel, to: SongbookItemViewModel) => {
    const id = sectionIds.current.get(from);
    if (id) { sectionIds.current.set(to, id); }
  }, []);
  return { entries, keepSectionId };
}
