import { Button } from "../../../atoms/Button";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { BsChevronDown, BsChevronRight, BsFillTrashFill, BsPencilFill } from "react-icons/bs";

interface SongBookSectionRowProps {
  handleDelete: () => void;
  dragHandle: ReactNode;
  title: string;
  /** Songs in the section; with none there is nothing to collapse. */
  scoreCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRename: (title: string) => void;
}

export function SongBookSectionRow({
  handleDelete, dragHandle, title, scoreCount, collapsed, onToggleCollapsed, onRename,
}: SongBookSectionRowProps) {
  const name = title || "sem título";
  // The title turns into a field while editing: Enter or leaving it saves,
  // Esc cancels.
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (save: boolean) => {
    if (draft === null) { return; }
    if (save && draft.trim() !== title) { onRename(draft.trim()); }
    setDraft(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); finish(true); }
    if (event.key === "Escape") { event.preventDefault(); finish(false); }
  };

  return (
    <div className="songbook-section-row">
      {dragHandle}
      {scoreCount > 0 && (
        <Button type="button" variant="text" className="p-0 songbook-section-toggle"
          aria-label={`${collapsed ? "Expandir" : "Recolher"} seção ${name}`}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}>
          {collapsed ? <BsChevronRight aria-hidden="true" /> : <BsChevronDown aria-hidden="true" />}
        </Button>
      )}
      {draft === null ? (
        <div className="songbook-section-title">
          {title || "Seção sem título"}
          {collapsed && (
            <span className="songbook-section-count">
              {" "}· {scoreCount} música{scoreCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      ) : (
        <input className="songbook-section-title songbook-section-title-input"
          aria-label={`Nome da seção ${name}`}
          value={draft}
          placeholder="Seção sem título"
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => finish(true)} />
      )}
      <div className="songbook-section-actions">
        <Button type="button" variant="text" className="p-0"
          aria-label={`Editar seção ${name}`}
          onClick={() => setDraft(title)}>
          <BsPencilFill aria-hidden="true" />
        </Button>
        <Button type="button" variant="text" className="p-0" onClick={handleDelete}
          aria-label={`Remover seção ${name}`}>
          <BsFillTrashFill aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
