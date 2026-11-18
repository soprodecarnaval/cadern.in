import { Button } from "../../../atoms/Button";
import type { ReactNode } from "react";
import { BsChevronDown, BsChevronRight, BsFillTrashFill } from "react-icons/bs";

interface SongBookSectionRowProps {
  handleDelete: () => void;
  dragHandle: ReactNode;
  title: string;
  /** Songs in the section; with none there is nothing to collapse. */
  scoreCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function SongBookSectionRow({
  handleDelete, dragHandle, title, scoreCount, collapsed, onToggleCollapsed,
}: SongBookSectionRowProps) {
  const name = title || "sem título";
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
      <div className="songbook-section-title">
        {title || "Seção sem título"}
        {collapsed && (
          <span className="songbook-section-count">
            {" "}· {scoreCount} música{scoreCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <Button type="button" variant="text" className="p-0" onClick={handleDelete}
        aria-label={`Remover seção ${name}`}>
        <BsFillTrashFill aria-hidden="true" />
      </Button>
    </div>
  );
}
