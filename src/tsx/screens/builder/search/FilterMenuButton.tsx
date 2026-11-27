import { Dropdown } from "react-bootstrap";
import { BsCheck } from "react-icons/bs";
import { FilterIcon } from "../../../components/songbooks/editor/toolbar/toolbarIcons";
import { filterCount, NO_FILTERS, type ResultsFilters } from "./resultsFilter";
import "../../../components/songbooks/editor/toolbar/SongbookToolbar.css";

const GROUPS = [
  { key: "styles", label: "Estilo" },
  { key: "projects", label: "Arranjo" },
] as const;

/** Resultados' "Filtrar" button: a menu of the styles and arrangements among
 *  the songs found, each ticked on or off; the menu stays open while
 *  choosing. The button shows how many filters are on. */
export function FilterMenuButton({ options, value, onChange }: {
  options: ResultsFilters;
  value: ResultsFilters;
  onChange: (filters: ResultsFilters) => void;
}) {
  const count = filterCount(value);
  const label = count ? `Filtrar (${count} ${count === 1 ? "filtro" : "filtros"})` : "Filtrar";
  const toggle = (key: keyof ResultsFilters, option: string) => {
    const chosen = value[key];
    onChange({
      ...value,
      [key]: chosen.includes(option) ? chosen.filter((x) => x !== option) : [...chosen, option],
    });
  };

  return (
    <Dropdown align="end" autoClose="outside">
      <Dropdown.Toggle as="button" type="button"
        className={`songbook-tool songbook-tool-menu is-small${count ? " is-active" : ""}`}
        aria-label={label} title={label}>
        <FilterIcon />
        {count > 0 && <span className="songbook-tool-badge" aria-hidden="true">{count}</span>}
      </Dropdown.Toggle>
      <Dropdown.Menu className="songbook-tool-options songbook-filter-menu">
        {GROUPS.map((group) => (
          <div key={group.key} role="group" aria-label={group.label}>
            <Dropdown.Header>{group.label}</Dropdown.Header>
            {[...new Set([...value[group.key], ...options[group.key]])].map((option) => {
              const on = value[group.key].includes(option);
              return (
                <button key={option} type="button" role="menuitemcheckbox" aria-checked={on}
                  className={`songbook-tools-option${on ? " active" : ""}`}
                  onClick={() => toggle(group.key, option)}>
                  <BsCheck aria-hidden="true" className="songbook-tool-check" />
                  {option}
                </button>
              );
            })}
          </div>
        ))}
        <button type="button" className="songbook-tools-option songbook-filter-clear"
          disabled={count === 0} onClick={() => onChange(NO_FILTERS)}>
          Limpar filtros
        </button>
      </Dropdown.Menu>
    </Dropdown>
  );
}
