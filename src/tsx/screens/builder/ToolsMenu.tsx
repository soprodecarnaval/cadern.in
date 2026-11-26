import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Dropdown } from "react-bootstrap";
import { BsCheck, BsChevronDown, BsChevronRight } from "react-icons/bs";
import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { SORT_OPTIONS } from "../../components/scores/sortOptions";
import type { SongbookToolsProps } from "./SongbookToolbar";
import {
  AddSectionIcon,
  CollapseAllIcon,
  ExpandAllIcon,
  MakeSectionsIcon,
  SaveIcon,
  SortIcon,
  ToolsIcon,
  UndoIcon,
} from "./toolbarIcons";
import "./SongbookToolbar.css";

/** Undo and redo's keys, as this computer writes them. */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const UNDO_KEYS = IS_MAC ? "⌘Z" : "Ctrl+Z";
const REDO_KEYS = IS_MAC ? "⇧⌘Z" : "Ctrl+Shift+Z";

function ToolItem({ icon, label, onClick, disabled = false, expanded, primary = false, shortcut }: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** For an item that opens more choices below it. */
  expanded?: boolean;
  primary?: boolean;
  /** Its keyboard shortcut, shown at the right. */
  shortcut?: string;
}) {
  return (
    <button type="button" className={`songbook-tools-item${primary ? " is-primary" : ""}`}
      onClick={onClick} disabled={disabled} aria-expanded={expanded}>
      <span className="songbook-tools-item-icon">{icon}</span>
      <span className="songbook-tools-item-label">{label}</span>
      {shortcut && <kbd className="songbook-tools-item-keys">{shortcut}</kbd>}
      {expanded !== undefined && (expanded
        ? <BsChevronDown aria-hidden="true" className="songbook-tools-item-more" />
        : <BsChevronRight aria-hidden="true" className="songbook-tools-item-more" />)}
    </button>
  );
}

/** The toolbar's first button: a menu of every Caderninho tool, each with
 *  its icon and name. "Ordenar por" and "Adicionar seção" open their
 *  choices or field inside the menu; the others run and close it. */
export function ToolsMenu({
  canUndo, canRedo, onUndo, onRedo,
  canMakeSections, onMakeSections,
  onAddSection,
  sortValue, onSort,
  sectionsCollapsed, onSetAllCollapsed,
  canSave, onSave,
}: SongbookToolsProps) {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState<"sort" | "add" | null>(null);
  const [title, setTitle] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open === "add") { field.current?.focus(); }
  }, [open]);

  const toggle = (next: boolean) => {
    window.clearTimeout(closeTimer.current);
    setShow(next);
    if (!next) { setOpen(null); }
  };
  // Opens on hover too, and closes a moment after the pointer leaves the
  // button and menu, so crossing the gap between them doesn't close it.
  // While the new section's field is open it stays, to keep what's typed.
  const closeTimer = useRef<number | undefined>(undefined);
  const hoverOpen = () => {
    window.clearTimeout(closeTimer.current);
    setShow(true);
  };
  const hoverClose = () => {
    if (open === "add") { return; }
    closeTimer.current = window.setTimeout(() => toggle(false), 200);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  /** Runs a tool and closes the menu. */
  const run = (action: () => void) => () => {
    action();
    toggle(false);
  };
  const addSection = (event: FormEvent) => {
    event.preventDefault();
    onAddSection(title.trim());
    setTitle("");
    toggle(false);
  };
  const allCollapsed = sectionsCollapsed === "all";

  return (
    <Dropdown show={show} autoClose="outside" onToggle={toggle}
      className="songbook-tools-dropdown"
      onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <Dropdown.Toggle as="button" type="button"
        className="songbook-tool songbook-tool-menu is-dark"
        aria-label="Menu" title="Menu">
        <ToolsIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className="songbook-tool-options songbook-tools-menu">
        <ToolItem icon={<UndoIcon />} label="Desfazer" shortcut={UNDO_KEYS} disabled={!canUndo} onClick={run(onUndo)} />
        <ToolItem icon={<UndoIcon mirrored />} label="Refazer" shortcut={REDO_KEYS} disabled={!canRedo} onClick={run(onRedo)} />
        <ToolItem icon={<AddSectionIcon />} label="Adicionar seção"
          expanded={open === "add"} onClick={() => setOpen(open === "add" ? null : "add")} />
        {open === "add" && (
          <form className="songbook-tools-sub songbook-add-section-form" onSubmit={addSection}>
            <Input ref={field} type="text" value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="Nome da nova seção" placeholder="Nome da seção" />
            <Button type="submit" className="songbook-add-section-submit"
              aria-label="Adicionar seção" title="Adicionar seção">
              <span className="songbook-add-section-plus">+</span>
            </Button>
          </form>
        )}
        <ToolItem icon={<SortIcon />} label="Ordenar por" disabled={!canMakeSections}
          expanded={open === "sort"} onClick={() => setOpen(open === "sort" ? null : "sort")} />
        {open === "sort" && (
          <div className="songbook-tools-sub" role="group" aria-label="Ordenar por">
            {SORT_OPTIONS.map((option) => (
              <button key={option.value} type="button"
                className={`songbook-tools-option${option.value === sortValue ? " active" : ""}`}
                aria-pressed={option.value === sortValue}
                onClick={run(() => onSort(option.value))}>
                <BsCheck aria-hidden="true" className="songbook-tool-check" />
                {option.label}
              </button>
            ))}
          </div>
        )}
        <ToolItem icon={<MakeSectionsIcon />} label="Criar seções por estilo"
          disabled={!canMakeSections} onClick={run(onMakeSections)} />
        <ToolItem icon={allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}
          label={allCollapsed ? "Expandir todas as seções" : "Recolher todas as seções"}
          disabled={sectionsCollapsed === "none"}
          onClick={run(() => onSetAllCollapsed(!allCollapsed))} />
        {onSave && (
          <ToolItem icon={<SaveIcon />} label="Salvar caderninho" primary
            disabled={!canSave} onClick={run(onSave)} />
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}
