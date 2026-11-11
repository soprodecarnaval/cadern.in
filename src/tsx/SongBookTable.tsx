import {
  Button,
  Col,
  Form,
  ListGroup,
  OverlayTrigger,
  Row,
  Tooltip,
} from "react-bootstrap";

import type { ScoreViewModel, SongbookItemViewModel, SongbookScoreViewModel } from "../../types/viewModels";
import { isSongbookSection, songbookSection } from "../lib/songbook";
import type { ScoreEditUpdate } from "./ScoreEditModal";

import { SongbookSortableList, type SongbookSortableListHandle } from "./SongbookSortableList";
import { ChangeEvent, forwardRef, useState } from "react";
import { Sort } from "./Sort";
import {
  deleteRow,
  generateCarnivalSections,
  generateSectionsByStyle,
  sortSongsWithinSections,
} from "../utils/songBookRows";
import { carnivalSectionOrder } from "../utils/sort";

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

  const CarnivalSectionsToolTip = () => (
    <Tooltip id="tooltip">
      Reorganiza seções como no caderninho do carnaval:
      <ListGroup>
        {carnivalSectionOrder.map((section) => (
          <ListGroup.Item key={`section-${section}`}>{section}</ListGroup.Item>
        ))}
      </ListGroup>
    </Tooltip>
  );

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
        <Col sm="4">
          <Sort
            onSortBy={(col, dir) =>
              setRows(sortSongsWithinSections(rows, col, dir))
            }
          />
        </Col>
        <Col>
          <Form className="d-flex" onSubmit={onSubmitNewSection}>
            <Col>
              <Form.Control
                type="text"
                onChange={onInputNewSection}
                value={newSection}
                placeholder="Adicionar seção"
              />
            </Col>
            <Col>
              <Button onClick={createNewSection}>+ seção</Button>
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
        <Col>
          <Button onClick={handleClear}>Limpar tudo</Button>
        </Col>
      </Row>
      <Row>
        <Col>
          <Button onClick={() => setRows(generateSectionsByStyle(rows))}>
            Gerar seções por estilo
          </Button>
        </Col>
      </Row>
      <Row>
        <Col>
          <OverlayTrigger placement="left" overlay={CarnivalSectionsToolTip}>
            <Button onClick={() => setRows(generateCarnivalSections(rows))}>
              Aplicar ordenação do carnaval
            </Button>
          </OverlayTrigger>
        </Col>
      </Row>
    </>
  );
});

export { SongBookTable };
