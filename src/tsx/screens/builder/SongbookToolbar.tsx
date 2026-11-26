import { useEffect } from "react";
import { AddSectionMenuButton } from "./AddSectionMenuButton";
import { ToolsMenu } from "./ToolsMenu";
import { CollapseAllIcon, ExpandAllIcon, MakeSectionsIcon, SaveIcon, UndoIcon } from "./toolbarIcons";
import { SortMenuButton } from "./SortMenuButton";
import type { SectionsCollapsed } from "../../components/songbooks/editor/SongbookSortableList";
import "./SongbookToolbar.css";

/** Typing in a field keeps the field's own undo. */
const isEditingText = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The Caderninho's tools, beside "Salvar caderninho". Undo and redo also
 *  answer to Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y). */
export interface SongbookToolsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canMakeSections: boolean;
  onMakeSections: () => void;
  onAddSection: (title: string) => void;
  /** The sort last applied ("" when none, or after songs were moved by hand). */
  sortValue: string;
  onSort: (value: string) => void;
  sectionsCollapsed: SectionsCollapsed;
  onSetAllCollapsed: (collapse: boolean) => void;
  canSave: boolean;
  /** "Salvar caderninho"; left out where saving isn't offered. */
  onSave?: () => void;
}

export function SongbookToolbar(props: SongbookToolsProps) {
  const {
    canUndo, canRedo, onUndo, onRedo,
    canMakeSections, onMakeSections,
    onAddSection,
    sortValue, onSort,
    sectionsCollapsed, onSetAllCollapsed,
    canSave, onSave,
  } = props;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || isEditingText(event.target)) { return; }
      const key = event.key.toLowerCase();
      const redo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
      const undo = key === "z" && !event.shiftKey;
      if (undo && canUndo) { event.preventDefault(); onUndo(); }
      if (redo && canRedo) { event.preventDefault(); onRedo(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo]);

  const allCollapsed = sectionsCollapsed === "all";
  const collapseLabel = allCollapsed ? "Expandir todas as seções" : "Recolher todas as seções";

  return (
    <div className="songbook-toolbar" role="toolbar" aria-label="Ferramentas do caderninho">
      <ToolsMenu {...props} />
      <button type="button" className="songbook-tool" onClick={onUndo} disabled={!canUndo}
        aria-label="Desfazer" title="Desfazer">
        <UndoIcon />
      </button>
      <button type="button" className="songbook-tool" onClick={onRedo} disabled={!canRedo}
        aria-label="Refazer" title="Refazer">
        <UndoIcon mirrored />
      </button>
      <AddSectionMenuButton onAdd={onAddSection} />
      <SortMenuButton value={sortValue} onSort={onSort} disabled={!canMakeSections} />
      <button type="button" className="songbook-tool" onClick={onMakeSections} disabled={!canMakeSections}
        aria-label="Criar seções por estilo" title="Criar seções por estilo">
        <MakeSectionsIcon />
      </button>
      <button type="button" className="songbook-tool" onClick={() => onSetAllCollapsed(!allCollapsed)}
        disabled={sectionsCollapsed === "none"}
        aria-label={collapseLabel} title={collapseLabel}>
        {allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}
      </button>
      {onSave && (
        <button type="button" className="songbook-tool is-primary songbook-save" onClick={onSave}
          disabled={!canSave} aria-label="Salvar caderninho" title="Salvar caderninho">
          <SaveIcon />
          {/* Beside the icon when the column has room for it. */}
          <span className="songbook-save-label" aria-hidden="true">Salvar</span>
        </button>
      )}
    </div>
  );
}
