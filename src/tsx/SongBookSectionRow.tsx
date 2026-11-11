import type { ReactNode } from "react";
import { BsFillTrashFill } from "react-icons/bs";

interface SongBookSectionRowProps {
  handleDelete: () => void;
  dragHandle: ReactNode;
  title: string;
}

export function SongBookSectionRow({ handleDelete, dragHandle, title }: SongBookSectionRowProps) {
  return (
    <div className="songbook-section-row">
      {dragHandle}
      <div className="songbook-section-title">{title || "Seção sem título"}</div>
      <button type="button" className="btn btn-link p-0" onClick={handleDelete}
        aria-label={`Remover seção ${title || "sem título"}`}>
        <BsFillTrashFill aria-hidden="true" />
      </button>
    </div>
  );
}
