import { Input } from "../../../atoms/Input";
import { Form } from "react-bootstrap";

import searchIcon from "../../../../assets/brand/search.svg";
import "./SearchBar.css";

/**
 * Montar's search box: the icon, the field and the hint on exact search
 * below. Montar searches its collection with it; a songbook's edit screen,
 * the project scores it can add.
 */
export function SearchField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <Form className="d-flex" onSubmit={(e) => e.preventDefault()}>
        <div className="search-field">
          <img src={searchIcon} alt="" className="search-field-icon" />
          <Form.Control as={Input}
            type="search"
            placeholder="Procurar por título, arranjo ou tags"
            aria-label="Search"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </Form>
      <small className="d-block text-muted lh-sm mt-2 mb-2">
        Para busca exata, use aspas e chapéuzinho (ex: "^carnaval bh 2024")
      </small>
    </>
  );
}
