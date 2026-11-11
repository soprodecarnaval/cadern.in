import { Col, Row, Spinner } from "react-bootstrap";

import type { ScoreViewModel } from "../../types/viewModels";
import type { SortColumn, SortDirection } from "../utils/sort";
import { ScoreSearchResultTable } from "./ScoreSearchResultTable";
import { Sort } from "./Sort";

export interface ScoreSearchResultsProps {
  results: ScoreViewModel[];
  searchQuery: string;
  onSortBy: (column: SortColumn, direction: SortDirection) => void;
  onSelectSong: (song: ScoreViewModel, checked: boolean) => void;
}

const ScoreSearchResultsView = ({
  collection,
  Card,
  results,
  searchQuery,
  onSortBy,
  onSelectSong,
}: ScoreSearchResultsProps & {
  collection: import("../useCollectionContext").CollectionContextValue;
  Card: import("react").ComponentType<import("./ScoreCardView").ScoreCardProps>;
}) => {
  const { status, getMatches } = collection;

  if (status === "loading") {
    return <Spinner animation="border" className="mt-4" />;
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="results">Resultados</h3>
      <Row>
        <Col sm="6">
          <Sort onSortBy={onSortBy} />
        </Col>
      </Row>
      <ScoreSearchResultTable
        key={searchQuery}
        Card={Card}
        getMatches={getMatches}
        scores={results}
        searchQuery={searchQuery}
        handleSelect={onSelectSong}
      />
    </>
  );
};

export { ScoreSearchResultsView };
