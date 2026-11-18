import { Col, Row, Spinner } from "react-bootstrap";

import type { ScoreViewModel } from "../../../../../types/viewModels";
import type { SortColumn, SortDirection } from "../../../../utils/sort";
import { ScoreSearchResultTable } from "./ScoreSearchResultTable";
import { Sort } from "../../../components/scores/Sort";

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
  collection: import("../../../../useCollectionContext").CollectionContextValue;
  Card: import("react").ComponentType<import("../../../components/scores/card/ScoreCardView").ScoreCardProps>;
}) => {
  const { status } = collection;

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
        <Col xs={12} sm="auto">
          <Sort onSortBy={onSortBy} />
        </Col>
      </Row>
      <ScoreSearchResultTable
        key={searchQuery}
        Card={Card}
        scores={results}
        searchQuery={searchQuery}
        handleSelect={onSelectSong}
      />
    </>
  );
};

export { ScoreSearchResultsView };
