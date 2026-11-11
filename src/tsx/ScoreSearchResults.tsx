import { Spinner, Row, Col } from "react-bootstrap";
import { useCollectionContext } from "../useCollectionContext";
import type { ScoreViewModel } from "../../types/viewModels";
import { Sort } from "./Sort";
import { ScoreSearchResultTable } from "./ScoreSearchResultTable";
import type { SortColumn, SortDirection } from "../utils/sort";

interface ScoreSearchResultsProps {
  results: ScoreViewModel[];
  searchQuery: string;
  onSortBy: (column: SortColumn, direction: SortDirection) => void;
  onSelectSong: (song: ScoreViewModel, checked: boolean) => void;
}

const ScoreSearchResults = ({
  results,
  searchQuery,
  onSortBy,
  onSelectSong,
}: ScoreSearchResultsProps) => {
  const { status } = useCollectionContext();

  if (status === "loading") {
    return <Spinner animation="border" className="mt-4" />;
  }

  if (results.length === 0) {return null;}

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
        scores={results}
        searchQuery={searchQuery}
        handleSelect={onSelectSong}
      />
    </>
  );
};

export { ScoreSearchResults };
