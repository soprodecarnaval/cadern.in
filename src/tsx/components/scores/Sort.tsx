import { Select } from "../../atoms/Select";
import { ChangeEventHandler } from "react";
import { SortColumn, SortDirection } from "../../../utils/sort";

interface SortProps {
  onSortBy: (column: SortColumn, direction: SortDirection) => void;
  /** The chosen option, for a parent that resets it ("" is "Ordenar por"). */
  value?: string;
  onValueChange?: (value: string) => void;
}

const Sort = ({ onSortBy, value, onValueChange }: SortProps) => {
  const handleOnClick: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onValueChange?.(event.target.value);
    const [column, direction] = event.target.value.split("-") as [
      SortColumn,
      SortDirection
    ];
    onSortBy(column, direction);
  };

  return (
    <Select value={value} onChange={handleOnClick} className="mb-2">
      <option value="">Ordenar por</option>
      <option value="carnivalStyle">Estilo (carnaval)</option>
      <option value="title-asc">Título (A-Z)</option>
      <option value="title-desc">Título (Z-A)</option>
      <option value="projectTitle-asc">Arranjo (A-Z)</option>
      <option value="projectTitle-desc">Arranjo (Z-A)</option>
      <option value="style-asc">Estilo (A-Z)</option>
      <option value="style-desc">Estilo (Z-A)</option>
    </Select>
  );
};

export { Sort };
