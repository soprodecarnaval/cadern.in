import { Table } from "react-bootstrap";
import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { PointerSensor } from "@dnd-kit/dom";

import type { ScoreViewModel, PlayingPartViewModel } from "../../types/viewModels";

import { ScoreCard } from "./ScoreCard";
import { DragHandle } from "./DragHandle";
import { PaginationBar } from "./PaginationBar";

interface ScoreSearchResultTableProps {
  scores: ScoreViewModel[];
  handleSelect: (score: ScoreViewModel, checked: boolean) => void;
  onSetPlayingPart: (info: PlayingPartViewModel) => void;
}

function AvailableScoreCard({
  score,
  handleSelect,
  onSetPlayingPart,
}: {
  score: ScoreViewModel;
  handleSelect: (score: ScoreViewModel, checked: boolean) => void;
  onSetPlayingPart: (info: PlayingPartViewModel) => void;
}) {
  const [mode, setMode] = useState<"compact" | "expanded">("compact");
  // Pointer-only: no stable order to preserve, so no keyboard drag affordance
  // here — keyboard users add via the "Adicionar" button instead.
  const { ref, handleRef } = useDraggable({
    id: `available:${score.id}`,
    data: { group: "available", score },
    sensors: [PointerSensor],
  });
  return (
    <tbody ref={ref}>
      <ScoreCard
        score={score}
        mode={mode}
        onToggleMode={() => setMode(mode === "compact" ? "expanded" : "compact")}
        onPlay={onSetPlayingPart}
        leading={<DragHandle label={`Arraste ${score.title} para o caderninho`} handleRef={handleRef} onPrepareDrag={() => undefined} />}
        trailing={
          <td>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => handleSelect(score, true)}
            >
              Adicionar
            </button>
          </td>
        }
      />
    </tbody>
  );
}

const ScoreSearchResultTable = ({
  scores,
  handleSelect,
  onSetPlayingPart: handlePlayingSong,
}: ScoreSearchResultTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const maxNumberPages = Math.round(scores.length / 10) + 1;

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Drop zone for songbook cards dragged back out: removes them, regardless
  // of where in this list they're dropped.
  const { ref: dropRef } = useDroppable({
    id: "available-dropzone",
    data: { group: "available" },
    accept: (source) =>
      (source.data as { group?: string; itemType?: string }).group === "songbook" &&
      (source.data as { itemType?: string }).itemType === "score",
  });

  return (
    <>
      <Table ref={dropRef} striped borderless hover>
        <thead>
          <tr>
            <th><span className="visually-hidden">Mover</span></th>
            <th></th>
            <th>Título</th>
            <th>Arranjo</th>
            <th>Tags</th>
            <th><span className="visually-hidden">Adicionar</span></th>
          </tr>
        </thead>
        {scores.slice((currentPage - 1) * 10, currentPage * 10).map((song) => (
          <AvailableScoreCard
            handleSelect={handleSelect}
            score={song}
            key={song.id}
            onSetPlayingPart={handlePlayingSong}
          />
        ))}
      </Table>
      <PaginationBar
        onChange={handlePageChange}
        currentPage={currentPage}
        maxNumberPages={maxNumberPages}
      />
    </>
  );
};

export { ScoreSearchResultTable };
