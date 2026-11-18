import { Input } from "../../../atoms/Input";
import { Button } from "../../../atoms/Button";
import { Col, Form, Row } from "react-bootstrap";

import type {
  ScoreViewModel,
  SongbookItemViewModel,
  SongbookScoreViewModel,
} from "../../../../../types/viewModels";
import { isSongbookSection, songbookSection } from "../../../../lib/songbook";
import type { ScoreEditUpdate } from "../../scores/edit/ScoreEditModal";

import { ChangeEvent, forwardRef, useState } from "react";
import {
  deleteRow,
  generateSectionsByStyle,
  sortSongsWithinSections,
} from "../../../../utils/songBookRows";
import {
  SongbookSortableList,
  type SectionsCollapsed,
  type SongbookSortableListHandle,
} from "./SongbookSortableList";
import { Sort } from "../../scores/Sort";

export interface SongBookTableProps {
  rows: SongbookItemViewModel[];
  songbookProjectId?: string;
  setItems: (rows: SongbookItemViewModel[]) => void;
  handleSelect: (song: ScoreViewModel, checked: boolean) => void;
  handleClear: () => void;
  /** Off where "Criar seções por estilo" lives in a toolbar instead. */
  showSectionsByStyle?: boolean;
  onSectionsCollapsedChange?: (state: SectionsCollapsed) => void;
}

const SongBookTableView = forwardRef<
  SongbookSortableListHandle,
  SongBookTableProps & {
    Card: import("react").ComponentType<
      import("../../scores/card/ScoreCardView").ScoreCardProps
    >;
  }
>(
  (
    {
      Card,
      songbookProjectId,
      rows,
      setItems: setRows,
      handleSelect,
      handleClear,
      showSectionsByStyle = true,
      onSectionsCollapsedChange,
    },
    ref,
  ) => {
    const [newSection, setNewSection] = useState<string>("");
    // The sort last applied; cleared when an item is moved by hand, since the
    // list is then no longer in that order.
    const [sortValue, setSortValue] = useState("");

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
              value={sortValue}
              onValueChange={setSortValue}
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
                <Form.Control as={Input}
                  type="text"
                  onChange={onInputNewSection}
                  value={newSection}
                  aria-label="Adicionar seção"
                  placeholder="Adicionar seção"
                />
              </Col>
              <Col xs="auto">
                <Button
                  onClick={createNewSection}
                  className="px-0"
                  // Square, as tall as the field beside it (.ds-field, 48px).
                  style={{ width: "48px", height: "48px", padding: 0, fontSize: "28px", lineHeight: 1 }}
                  aria-label="Adicionar seção"
                  title="Adicionar seção"
                >
                  +
                </Button>
              </Col>
            </Form>
          </Col>
        </Row>
        <SongbookSortableList
          Card={Card}
          songbookProjectId={songbookProjectId}
          ref={ref}
          rows={rows}
          onRename={setRows}
          onReorder={(reordered) => {
            setRows(reordered);
            setSortValue("");
          }}
          onDelete={(index) => setRows(deleteRow(rows, index))}
          onSelect={handleSelect}
          onUpdate={handleUpdateScore}
          onSectionsCollapsedChange={onSectionsCollapsedChange}
        />
        <div className="d-flex justify-content-between align-items-center gap-2 mt-4">
          <p className="m-0">
            {rows.filter(isSongbookSection).length} seções e{" "}
            {rows.filter((r) => !isSongbookSection(r)).length} músicas
          </p>
          <Button onClick={handleClear}>Limpar tudo</Button>
        </div>
        {showSectionsByStyle && (
          <Button className="mt-3" onClick={() => setRows(generateSectionsByStyle(rows))}>
            Criar seções por estilo
          </Button>
        )}
      </>
    );
  },
);

export { SongBookTableView };
