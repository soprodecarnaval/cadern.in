import { Pagination, Form } from "react-bootstrap";

import "./PaginationBar.css";

interface PaginationBarProps {
  currentPage: number;
  maxNumberPages: number;
  onChange: (nextCurrentPage: number) => void;
}

const PaginationBar = ({ onChange, currentPage, maxNumberPages } : PaginationBarProps) => (
  <>
    <Pagination className="paginationInfo">
    <Pagination.Prev
      onClick={() => onChange(currentPage - 1)}
      disabled={currentPage === 1}
    />

    <Form.Control
      value={currentPage}
      className="page"
      type="number"
      onChange={(event) => onChange(Number.parseInt(event.target.value))}
    />

    <Pagination.Item className="page" key={maxNumberPages} disabled>
      {maxNumberPages}
    </Pagination.Item>

    <Pagination.Next
      onClick={() => onChange(currentPage + 1)}
      disabled={currentPage === maxNumberPages}
    />
    </Pagination>
  </>
)

export { PaginationBar }
