import { ScoreViewModel } from "../../types";

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
  let sorted: ScoreViewModel[] = arrayToSort.sort((a: ScoreViewModel, b: ScoreViewModel) => {
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
  });

  if (directionToSort === "desc") sorted = sorted.reverse();

  return sorted;
};
