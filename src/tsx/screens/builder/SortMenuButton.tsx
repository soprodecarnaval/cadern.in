import { Dropdown } from "react-bootstrap";
import { BsCheck } from "react-icons/bs";
import { SORT_OPTIONS } from "../../components/scores/sortOptions";
import "./SongbookToolbar.css";
import { SortIcon } from "./toolbarIcons";

/** A square "Ordenar por" button opening the sort choices, the one last
 *  applied ticked. In the Caderninho toolbar and beside the results' page
 *  counter (`small`, at the counter's height). */
export function SortMenuButton({ value, onSort, disabled = false, small = false }: {
  /** The sort last applied, "" for none. */
  value: string;
  onSort: (value: string) => void;
  disabled?: boolean;
  small?: boolean;
}) {
  const choice = SORT_OPTIONS.find((option) => option.value === value);
  const label = choice ? `Ordenar por: ${choice.label}` : "Ordenar por";
  return (
    <Dropdown align="end" onSelect={(selected) => selected && onSort(selected)}>
      <Dropdown.Toggle as="button" type="button"
        className={`songbook-tool songbook-tool-menu${small ? " is-small" : ""}`}
        disabled={disabled} aria-label={label} title={label}>
        <SortIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className="songbook-tool-options">
        <Dropdown.Header>Ordenar por</Dropdown.Header>
        {SORT_OPTIONS.map((option) => (
          <Dropdown.Item key={option.value} as="button" eventKey={option.value}
            active={option.value === value}>
            <BsCheck aria-hidden="true" className="songbook-tool-check" />
            {option.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
