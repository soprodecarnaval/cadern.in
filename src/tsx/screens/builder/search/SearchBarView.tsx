import { useState, useEffect } from "react";
import { Row, Col } from "react-bootstrap";

import type { ScoreViewModel } from "../../../../../types/viewModels";
import type { CollectionStatus } from "../../../../useCollectionContext";

import { SearchField } from "./SearchField";

interface SearchBarViewProps {
  status: CollectionStatus;
  search: (query: string) => ScoreViewModel[];
  handleResults: (results: ScoreViewModel[], query: string) => void;
}

const SearchBarView = ({
  handleResults,
  status,
  search,
}: SearchBarViewProps) => {
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (status !== "ready") {
      return;
    }
    handleResults(search(searchInput), searchInput);
  }, [searchInput, status, handleResults, search]);

  return (
    <Row className="mt-4">
      <Col>
        <SearchField value={searchInput} onChange={setSearchInput} disabled={status !== "ready"} />
      </Col>
    </Row>
  );
};

export { SearchBarView };
