import { Select } from "../../atoms/Select";
import { ChangeEventHandler } from "react";
import { SortColumn, SortDirection } from "../../../utils/sort";
import { parseSortValue, SORT_OPTIONS } from "./sortOptions";

interface SortProps {
  onSortBy: (column: SortColumn, direction: SortDirection) => void;
  /** The chosen option, for a parent that resets it ("" is "Ordenar por"). */
  value?: string;
  onValueChange?: (value: string) => void;
}

const Sort = ({ onSortBy, value, onValueChange }: SortProps) => {
  const handleOnClick: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onValueChange?.(event.target.value);
    onSortBy(...parseSortValue(event.target.value));
  };

  return (
    <Select value={value} onChange={handleOnClick} className="mb-2">
      <option value="">Ordenar por</option>
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </Select>
  );
};

export { Sort };
