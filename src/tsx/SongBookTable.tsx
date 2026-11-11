import { Button, Col, Form, Row } from "react-bootstrap";

import type { ScoreViewModel, SongbookItemViewModel, SongbookScoreViewModel } from "../../types/viewModels";
import { isSongbookSection, songbookSection } from "../lib/songbook";
import type { ScoreEditUpdate } from "./ScoreEditModal";

import { SongbookSortableList, type SongbookSortableListHandle } from "./SongbookSortableList";
import { ChangeEvent, forwardRef, useState } from "react";
import { Sort } from "./Sort";
import {
  deleteRow,
  generateSectionsByStyle,
  sortSongsWithinSections,
} from "../utils/songBookRows";

interface SongBookTableProps {
  rows: SongbookItemViewModel[];
  setItems: (rows: SongbookItemViewModel[]) => void;
  handleSelect: (song: ScoreViewModel, checked: boolean) => void;
  handleClear: () => void;
}

const SongBookTable = forwardRef<SongbookSortableListHandle, SongBookTableProps>(({
  rows,
  setItems: setRows,
  handleSelect,
  handleClear,
}, ref) => {
  const [newSection, setNewSection] = useState<string>("");

  const onInputNewSection = (e: ChangeEvent<HTMLInputElement>) =>
    setNewSection(e.target.value);

  const onSubmitNewSection = (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    createNewSection();
  };

  const createNewSection = () => {
    const newRows = [...rows, songbookSection(newSection)];
    setRows(newRows);
    setNewSection("");
  };

  const handleUpdateScore = (idx: number, update: ScoreEditUpdate) => {
    const newRows = [...rows];
    const existing = newRows[idx] as SongbookScoreViewModel;
    const updatedScore: ScoreViewModel = {
      ...existing.score,
      title: update.title,
      composer: update.composer,
      sub: update.sub,
      tags: update.tags,
      latestRevision: {
        ...existing.score.latestRevision,
        parts: existing.score.latestRevision.parts.map((p, i) => ({
          ...p,
          name: update.parts[i]?.name ?? p.name,
        })),
      },
    };
    newRows[idx] = { ...existing, score: updatedScore };
    setRows(newRows);
  };

  return (
    <>
      <Row>
        <Col xs={12} sm="auto">
          <Sort
            onSortBy={(col, dir) =>
              setRows(sortSongsWithinSections(rows, col, dir))
            }
          />
        </Col>
        <Col>
          <Form
            className="d-flex justify-content-end gap-1 mb-2"
            onSubmit={onSubmitNewSection}
          >
            <Col style={{ maxWidth: "200px" }}>
              <Form.Control
                type="text"
                onChange={onInputNewSection}
                value={newSection}
                placeholder="Adicionar seção"
              />
            </Col>
            <Col xs="auto">
              <Button
                onClick={createNewSection}
                className="px-0"
                // Square: as wide as Bootstrap's input/button height.
                style={{ width: "calc(1.5em + 0.75rem + 2px)" }}
                aria-label="Adicionar seção"
                title="Adicionar seção"
              >
                +
              </Button>
            </Col>
          </Form>
        </Col>
      </Row>
      <SongbookSortableList ref={ref} rows={rows} onReorder={setRows}
        onDelete={(index) => setRows(deleteRow(rows, index))}
        onSelect={handleSelect} onUpdate={handleUpdateScore} />
      <Row className="mt-4">
        <Col>
          <p>
            {rows.filter(isSongbookSection).length} seções e{" "}
            {rows.filter((r) => !isSongbookSection(r)).length} músicas
          </p>
        </Col>
      </Row>
      <div className="d-flex justify-content-between gap-2">
        <Button onClick={() => setRows(generateSectionsByStyle(rows))}>
          Criar seções por estilo
        </Button>
        <Button onClick={handleClear}>Limpar tudo</Button>
      </div>
    </>
  );
});

export { SongBookTable };
