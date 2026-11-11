import { useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import { BsFillTrashFill, BsPencilFill } from "react-icons/bs";
import type { ScoreViewModel } from "../../types/viewModels";
import type { SongbookEditorItem } from "../lib/songbookReorder";
import { DragHandle } from "./DragHandle";
import { ScoreCard } from "./ScoreCard";
import { SongBookSectionRow } from "./SongBookSectionRow";
import { ScoreEditModal, type ScoreEditUpdate } from "./ScoreEditModal";

function SongbookScoreCard({
  score,
  dragHandle,
  hideDetails,
  handleDelete,
  handleUpdateScore,
}: {
  score: ScoreViewModel;
  dragHandle: ReactNode;
  hideDetails: boolean;
  handleDelete: (score: ScoreViewModel, checked: boolean) => void;
  handleUpdateScore: (update: ScoreEditUpdate) => void;
}) {
  const [mode, setMode] = useState<"compact" | "expanded">("compact");
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <>
      <ScoreCard
        score={score}
        mode={hideDetails ? "compact" : mode}
        onToggleMode={() => setMode(mode === "compact" ? "expanded" : "compact")}
        leading={dragHandle}
        trailing={
          <div className="score-card-actions">
            <button type="button" className="btn btn-link p-0"
              aria-label={`Remover ${score.title}`}
              onClick={() => handleDelete(score, false)}>
              <BsFillTrashFill aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-link p-0"
              aria-label={`Editar ${score.title}`}
              onClick={() => setShowEditModal(true)}>
              <BsPencilFill aria-hidden="true" />
            </button>
          </div>
        }
      />
      <ScoreEditModal
        show={showEditModal}
        score={score}
        onHide={() => setShowEditModal(false)}
        onSave={handleUpdateScore}
      />
    </>
  );
}

export function SortableSongbookRow({ entry, index, sorting, insertion, emptySection, onDelete,
  onSelect, onUpdate, onPrepareDrag, carried, disableDrop, scoreCount }: {
  entry: SongbookEditorItem;
  index: number;
  sorting: boolean;
  emptySection: boolean;
  insertion?: "before" | "after";
  onDelete: () => void;
  onPrepareDrag: (keyboard: boolean) => void;
  carried: boolean;
  disableDrop: boolean;
  scoreCount: number;
  onSelect: (score: ScoreViewModel, checked: boolean) => void;
  onUpdate: (update: ScoreEditUpdate) => void;
}) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: entry.id,
    index,
    data: {
      itemType: entry.item.type,
      group: "songbook",
      score: entry.item.type === "score" ? entry.item.score : undefined,
    },
    disabled: { droppable: disableDrop },
    plugins: (defaults) => defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
  });
  const { item } = entry;
  const section = item.type === "section";
  const label = section ? `Mover seção ${item.title || "sem título"} (${scoreCount} música${scoreCount === 1 ? "" : "s"})` : `Mover música ${item.score.title}`;
  const handle = <DragHandle label={label} handleRef={handleRef} onPrepareDrag={onPrepareDrag} />;
  return (
    <div ref={ref} data-editor-id={entry.id} data-item-type={item.type}
      className={[
        "songbook-card-entry",
        isDragSource ? "songbook-row-dragging" : "",
        carried ? "songbook-row-carried" : "",
        insertion ? `songbook-insert-${insertion}` : "",
      ].join(" ")}>
      {section ? (
        <>
          <SongBookSectionRow title={item.title} dragHandle={handle} handleDelete={onDelete} />
          {emptySection && <div className="songbook-empty-section">
            Solte uma música após este título.
          </div>}
        </>
      ) : (
        <SongbookScoreCard score={item.score} dragHandle={handle} hideDetails={sorting}
          handleDelete={onSelect} handleUpdateScore={onUpdate} />
      )}
    </div>
  );
}
