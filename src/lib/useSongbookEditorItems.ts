import { useMemo, useRef } from "react";
import type { SongbookItemViewModel } from "../../types/viewModels";
import { identifySongbookItems } from "./songbookReorder";

export function useSongbookEditorItems(rows: SongbookItemViewModel[]) {
  const sectionIds = useRef(new WeakMap<SongbookItemViewModel, string>());
  return useMemo(() => identifySongbookItems(rows, sectionIds.current), [rows]);
}
