import { useState, useEffect } from "react";
import { Row, Col, Form } from "react-bootstrap";

import type { ScoreViewModel } from "../../types/viewModels";
import { useCollectionContext } from "../useCollectionContext";

interface SearchBarProps {
  handleResults: (results: ScoreViewModel[]) => void;
}

const SearchBar = ({ handleResults }: SearchBarProps) => {
  const { status, search } = useCollectionContext();
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (status !== "ready") return;
    handleResults(search(searchInput));
  }, [searchInput, status, handleResults, search]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  return (
    <Row className="mt-4">
      <Col sm={6}>
        <Form className="d-flex">
          <Form.Control
            type="search"
            placeholder="Procurar por título, arranjo ou tags"
            className="me-2"
            aria-label="Search"
            disabled={status !== "ready"}
            onKeyDown={handleKeyDown}
            value={searchInput}
            onChange={handleChange}
          />
        </Form>
      </Col>
      <small>
        Para busca exata, use aspas e chapéuzinho (ex: "^carnaval bh 2024")
      </small>
    </Row>
  );
};

export { SearchBar };
