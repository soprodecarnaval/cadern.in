import type { ComponentProps, ReactNode } from "react";
import { isSongbookSection, songbookSection } from "../../../../lib/songbook";
import { generateSectionsByStyle, sortSongsWithinSections } from "../../../../utils/songBookRows";
import { parseSortValue } from "../../scores/sortOptions";
import { SongBookTableView } from "./SongBookTableView";
import type { SongbookEditorState } from "./useSongbookEditor";
import { SongbookToolbar } from "./toolbar/SongbookToolbar";
import "./SongbookEditor.css";

/**
 * Montar's Caderninho toolbar. `onSave` adds the save button: on Montar it
 * opens "Salvar caderninho"; when editing a songbook, "Salvar versão".
 */
export function SongbookEditorToolbar({
  editor,
  onSave,
  saveLabel,
  canSave = editor.items.length > 0,
}: {
  editor: SongbookEditorState;
  onSave?: () => void;
  saveLabel?: string;
  /** Whether saving is offered now; by default, once there's a song. */
  canSave?: boolean;
}) {
  const { history, items, setItems, setSort } = editor;
  return (
    <SongbookToolbar
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      onUndo={() => { history.undo(); setSort(""); }}
      onRedo={() => { history.redo(); setSort(""); }}
      canMakeSections={items.some((item) => !isSongbookSection(item))}
      onMakeSections={() => {
        setItems(generateSectionsByStyle(items));
        setSort("");
      }}
      onAddSection={(title) => setItems([...items, songbookSection(title)])}
      sortValue={editor.sort}
      onSort={(value) => {
        setItems(sortSongsWithinSections(items, ...parseSortValue(value)));
        setSort(value);
      }}
      sectionsCollapsed={editor.sectionsCollapsed}
      canSave={canSave}
      onSave={onSave}
      saveLabel={saveLabel}
      onSetAllCollapsed={(collapse) => editor.listRef.current?.setAllSectionsCollapsed(collapse)}
    />
  );
}

/** Montar's Caderninho: its title and the list of sections and songs. */
export function SongbookEditorList({
  editor,
  Card,
  songbookProjectId,
  countAction,
  children,
}: {
  editor: SongbookEditorState;
  Card: ComponentProps<typeof SongBookTableView>["Card"];
  /** The project being edited, so songs from other projects say so. */
  songbookProjectId?: string;
  /** In place of "Limpar tudo", beside the count of sections and songs. */
  countAction?: ReactNode;
  /** Shown under the title, e.g. Montar's save dialog. */
  children?: ReactNode;
}) {
  return (
    <>
      <h3 className="results songbook-editor-title">Caderninho</h3>
      {children}
      <SongBookTableView
        Card={Card}
        songbookProjectId={songbookProjectId}
        ref={editor.listRef}
        rows={editor.items}
        setItems={editor.setItems}
        handleSelect={editor.select}
        handleClear={editor.clear}
        showSectionsByStyle={false}
        showSort={false}
        showAddSection={false}
        onManualReorder={() => editor.setSort("")}
        onSectionsCollapsedChange={editor.setSectionsCollapsed}
        countAction={countAction}
      />
    </>
  );
}
