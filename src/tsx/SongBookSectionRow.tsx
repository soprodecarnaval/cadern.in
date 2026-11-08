import type { ReactNode } from "react";
import { BsFillTrashFill } from "react-icons/bs";

interface SongBookSectionRowProps {
  handleDelete: () => void;
  dragHandle: ReactNode;
  title: string;
}

export function SongBookSectionRow({ handleDelete, dragHandle, title }: SongBookSectionRowProps) {
  return (
    <tr className="section-title">
      <td className="songbook-handle-cell">{dragHandle}</td>
      <th scope="row" colSpan={4}>{title || "Seção sem título"}</th>
      <td>
        <button type="button" className="btn btn-link p-0" onClick={handleDelete}
          aria-label={`Remover seção ${title || "sem título"}`}>
          <BsFillTrashFill aria-hidden="true" />
        </button>
      </td>
      <td colSpan={3} />
    </tr>
  );
}
