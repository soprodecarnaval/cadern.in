import type { ScoreViewModel } from "../../../../../types/viewModels";

/** What filtering looks at: a song's style (first tag) and arrangement. */
type Filterable = Pick<ScoreViewModel, "tags" | "projectTitle">;

/** What Resultados is narrowed to: songs of any of these styles (a song's
 *  first tag, in lower case: tags are written "axé" and "Axé") and any of
 *  these arrangements. An empty list doesn't narrow. */
export interface ResultsFilters {
  styles: string[];
  projects: string[];
}

export const NO_FILTERS: ResultsFilters = { styles: [], projects: [] };

export const filterCount = (filters: ResultsFilters) =>
  filters.styles.length + filters.projects.length;

/** A song's style, as the filter lists it. */
const styleOf = (score: Filterable) => (score.tags[0] ?? "").trim().toLocaleLowerCase("pt-BR");

export const filterScores = <T extends Filterable>(scores: T[], filters: ResultsFilters): T[] =>
  filterCount(filters) === 0 ? scores : scores.filter((score) =>
    (filters.styles.length === 0 || filters.styles.includes(styleOf(score))) &&
    (filters.projects.length === 0 || filters.projects.includes(score.projectTitle)));

const distinctSorted = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

/** The styles and arrangements among `scores`, to choose filters from. */
export const filterOptions = (scores: Filterable[]): ResultsFilters => ({
  styles: distinctSorted(scores.map(styleOf)),
  projects: distinctSorted(scores.map((score) => score.projectTitle)),
});
