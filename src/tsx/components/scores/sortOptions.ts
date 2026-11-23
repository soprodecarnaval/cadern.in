import type { SortColumn, SortDirection } from "../../../utils/sort";

/** The sort choices, by value ("column-direction"). */
export const SORT_OPTIONS = [
  { value: "carnivalStyle", label: "Estilo (carnaval)" },
  { value: "title-asc", label: "Título (A-Z)" },
  { value: "title-desc", label: "Título (Z-A)" },
  { value: "projectTitle-asc", label: "Arranjo (A-Z)" },
  { value: "projectTitle-desc", label: "Arranjo (Z-A)" },
  { value: "style-asc", label: "Estilo (A-Z)" },
  { value: "style-desc", label: "Estilo (Z-A)" },
] as const;

/** A sort choice's value as the column and direction to sort by. */
export const parseSortValue = (value: string) =>
  value.split("-") as [SortColumn, SortDirection];
