import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dropdown } from "react-bootstrap";
import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import "./SongbookToolbar.css";
import { AddSectionIcon } from "./toolbarIcons";

/** The Caderninho toolbar's "Adicionar seção": a square button opening a
 *  field for the new section's name. Enter or "+" adds it at the end of the
 *  list and closes; Esc or clicking away closes without adding. */
export function AddSectionMenuButton({ onAdd }: { onAdd: (title: string) => void }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) { field.current?.focus(); }
  }, [show]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAdd(title.trim());
    setTitle("");
    setShow(false);
  };

  return (
    <Dropdown align="end" show={show} autoClose="outside"
      onToggle={(next) => setShow(next)}>
      <Dropdown.Toggle as="button" type="button" className="songbook-tool songbook-tool-menu"
        aria-label="Adicionar seção" title="Adicionar seção">
        <AddSectionIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className="songbook-tool-options songbook-add-section">
        <form className="songbook-add-section-form" onSubmit={submit}>
          <Input ref={field} type="text" value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Nome da nova seção" placeholder="Nome da seção" />
          <Button type="submit" className="songbook-add-section-submit"
            aria-label="Adicionar seção" title="Adicionar seção">
            <span className="songbook-add-section-plus">+</span>
          </Button>
        </form>
      </Dropdown.Menu>
    </Dropdown>
  );
}
