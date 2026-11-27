import { useRef, useState } from "react";
import type { ScoreViewModel, SongbookItemViewModel } from "../../../../../types/viewModels";
import { isSongbookSection, songbookScore } from "../../../../lib/songbook";
import { useUndoableState } from "../../../../lib/useUndoableState";
import type { SectionsCollapsed, SongbookSortableListHandle } from "./SongbookSortableList";

/**
 * The Caderninho editor, as on Montar: its rows with undo and redo, the
 * toolbar's sort and folded sections. Montar and a songbook's edit screen
 * both build theirs with this hook, then place the toolbar and the list
 * where their layout puts them.
 */
export function useSongbookEditor(initial: SongbookItemViewModel[]) {
  const history = useUndoableState(initial);
  const { value: items, set: setItems } = history;
  const [sectionsCollapsed, setSectionsCollapsed] = useState<SectionsCollapsed>("none");
  // The sort last applied from the toolbar; cleared once the order changes
  // some other way.
  const [sort, setSort] = useState("");
  const listRef = useRef<SongbookSortableListHandle>(null);

  const add = (score: ScoreViewModel, index?: number) =>
    setItems((prev) => {
      const next = [...prev];
      next.splice(index ?? next.length, 0, songbookScore(score));
      return next;
    });
  const remove = (score: ScoreViewModel) =>
    setItems((prev) => prev.filter((r) => isSongbookSection(r) || r.score.id !== score.id));

  return {
    history,
    items,
    setItems,
    sectionsCollapsed,
    setSectionsCollapsed,
    sort,
    setSort,
    listRef,
    add,
    remove,
    /** Checked adds the song (at `index`, or the end); unchecked removes it. */
    select: (score: ScoreViewModel, checked: boolean, index?: number) =>
      checked ? add(score, index) : remove(score),
    clear: () => setItems([]),
  };
}

export type SongbookEditorState = ReturnType<typeof useSongbookEditor>;
