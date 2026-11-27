import { useState } from "react";
import { Spinner } from "react-bootstrap";

import type { ScoreViewModel } from "../../../../../types/viewModels";
import type { SortColumn, SortDirection } from "../../../../utils/sort";
import { ScoreSearchResultTable } from "./ScoreSearchResultTable";
import { parseSortValue } from "../../../components/scores/sortOptions";
import { SortMenuButton } from "../../../components/songbooks/editor/toolbar/SortMenuButton";
import { FilterMenuButton } from "./FilterMenuButton";
import { filterCount, type ResultsFilters } from "./resultsFilter";

export interface ScoreSearchResultsProps {
  results: ScoreViewModel[];
  searchQuery: string;
  onSortBy: (column: SortColumn, direction: SortDirection) => void;
  onSelectSong: (song: ScoreViewModel, checked: boolean) => void;
  /** Resultados' filters: what to choose from, what's chosen. */
  filter?: {
    options: ResultsFilters;
    value: ResultsFilters;
    onChange: (filters: ResultsFilters) => void;
  };
}

const ScoreSearchResultsView = ({
  collection,
  Card,
  results,
  searchQuery,
  onSortBy,
  onSelectSong,
  filter,
}: ScoreSearchResultsProps & {
  collection: import("../../../../useCollectionContext").CollectionContextValue;
  Card: import("react").ComponentType<import("../../../components/scores/card/ScoreCardView").ScoreCardProps>;
}) => {
  const { status } = collection;
  const [sortValue, setSortValue] = useState("");

  if (status === "loading") {
    return <Spinner animation="border" className="mt-4" />;
  }

  const filtering = filter !== undefined && filterCount(filter.value) > 0;
  // With filters on and nothing left, the filters stay in reach to undo.
  if (results.length === 0 && !filtering) {
    return null;
  }

  return (
    <>
      <h3 className="results">Resultados</h3>
      <ScoreSearchResultTable
        key={searchQuery}
        Card={Card}
        scores={results}
        searchQuery={searchQuery}
        handleSelect={onSelectSong}
        empty={filtering ? "Nenhuma música com esses filtros." : undefined}
        pagerEnd={
          <div className="d-flex gap-2">
            {filter && <FilterMenuButton {...filter} />}
            <SortMenuButton small value={sortValue} onSort={(value) => {
              setSortValue(value);
              onSortBy(...parseSortValue(value));
            }} />
          </div>
        }
      />
    </>
  );
};

export { ScoreSearchResultsView };
