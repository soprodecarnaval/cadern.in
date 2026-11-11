import type { ScoreViewModel } from "../../types/viewModels";

export const carnivalSectionOrder = [
  "marchinha",
  "beagá",
  "axé",
  "brega",
  "frevo",
  "pagode",
  "samba",
  "brazuka",
  "odara",
  "ebb",
  "funk",
  "internacional",
  "moments",
  // seções antigas (pré-2025), não estão nas mesmas ordens de antes
  "marcha rancho",
  "fanfarra",
  "rancho",
  "latina",
  "piseiro",
  "forrós",
  "technohell",
];
// carnaval agora é alfabético

export type SortColumn = "title" | "projectTitle" | "style" | "carnivalStyle";

export type SortDirection = "asc" | "desc";

export const sortByColumn = (
  arrayToSort: ScoreViewModel[],
  columnToSort: SortColumn,
  directionToSort: SortDirection,
): ScoreViewModel[] => {
  let sorted: ScoreViewModel[] = arrayToSort.sort(
    (a: ScoreViewModel, b: ScoreViewModel) => {
      if (columnToSort === "title") {
        return a.title.localeCompare(b.title);
      } else if (columnToSort === "projectTitle") {
        return a.projectTitle.localeCompare(b.projectTitle);
      } else if (columnToSort === "style") {
        if (a.tags[0] === b.tags[0]) {
          return a.tags[0].localeCompare(b.tags[0]);
        }
      } else if (columnToSort === "carnivalStyle") {
        if (a.tags[0] === b.tags[0]) {
          return a.tags[0].localeCompare(b.tags[0]);
        }
        const cmpSection =
          carnivalSectionOrder.indexOf(a.tags[0]) -
          carnivalSectionOrder.indexOf(b.tags[0]);
        return cmpSection == 0 ? a.title.localeCompare(b.title) : cmpSection;
      }
      return 0;
    },
  );

  if (directionToSort === "desc") {
    sorted = sorted.reverse();
  }

  return sorted;
};

/**
 * Reinserts scores removed from the songbook back into the library list,
 * preserving the library's active sort (or prepending them, unsorted, if
 * no sort is active).
 */
export const restoreToLibrary = (
  results: ScoreViewModel[],
  scores: ScoreViewModel[],
  sort: { column: SortColumn; direction: SortDirection } | null,
): ScoreViewModel[] =>
  sort
    ? sortByColumn([...results, ...scores], sort.column, sort.direction).slice()
    : [...scores, ...results];
