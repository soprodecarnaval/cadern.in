import { Input } from "../../atoms/Input";
import { Pagination, Form } from "react-bootstrap";

import arrowNext from "../../../assets/brand/arrow-next.svg";
import arrowPrev from "../../../assets/brand/arrow-prev.svg";
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
      className="page-arrow"
      onClick={() => onChange(currentPage - 1)}
      disabled={currentPage === 1}
    >
      <img src={arrowPrev} alt="" />
    </Pagination.Prev>

    <Form.Control as={Input}
      value={currentPage}
      className="page"
      type="number"
      onChange={(event) => onChange(Number.parseInt(event.target.value))}
    />

    <Pagination.Item className="page" key={maxNumberPages} disabled>
      {maxNumberPages}
    </Pagination.Item>

    <Pagination.Next
      className="page-arrow"
      onClick={() => onChange(currentPage + 1)}
      disabled={currentPage === maxNumberPages}
    >
      <img src={arrowNext} alt="" />
    </Pagination.Next>
    </Pagination>
  </>
)

export { PaginationBar }
