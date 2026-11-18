import { useEffect } from "react";
import {
  BsArrowClockwise,
  BsArrowCounterclockwise,
  BsArrowsCollapse,
  BsArrowsExpand,
  BsTags,
} from "react-icons/bs";
import type { SectionsCollapsed } from "../../components/songbooks/editor/SongbookSortableList";
import "./SongbookToolbar.css";

/** Typing in a field keeps the field's own undo. */
const isEditingText = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The Caderninho's tools, beside "Salvar caderninho". Undo and redo also
 *  answer to Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y). */
export function SongbookToolbar({
  canUndo, canRedo, onUndo, onRedo,
  canMakeSections, onMakeSections,
  sectionsCollapsed, onSetAllCollapsed,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canMakeSections: boolean;
  onMakeSections: () => void;
  sectionsCollapsed: SectionsCollapsed;
  onSetAllCollapsed: (collapse: boolean) => void;
}) {
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
      <button type="button" className="songbook-tool" onClick={onUndo} disabled={!canUndo}
        aria-label="Desfazer" title="Desfazer">
        <BsArrowCounterclockwise aria-hidden="true" />
      </button>
      <button type="button" className="songbook-tool" onClick={onRedo} disabled={!canRedo}
        aria-label="Refazer" title="Refazer">
        <BsArrowClockwise aria-hidden="true" />
      </button>
      <button type="button" className="songbook-tool" onClick={onMakeSections} disabled={!canMakeSections}
        aria-label="Criar seções por estilo" title="Criar seções por estilo">
        <BsTags aria-hidden="true" />
      </button>
      <button type="button" className="songbook-tool" onClick={() => onSetAllCollapsed(!allCollapsed)}
        disabled={sectionsCollapsed === "none"}
        aria-label={collapseLabel} title={collapseLabel}>
        {allCollapsed ? <BsArrowsExpand aria-hidden="true" /> : <BsArrowsCollapse aria-hidden="true" />}
      </button>
    </div>
  );
}
