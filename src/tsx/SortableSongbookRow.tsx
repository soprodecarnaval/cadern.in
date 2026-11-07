import { useSortable } from "@dnd-kit/react/sortable";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import type { PlayingPartViewModel, ScoreViewModel } from "../../types/viewModels";
import type { SongbookEditorItem } from "../lib/songbookReorder";
import { DragHandle } from "./DragHandle";
import { SongBookScoreRow } from "./SongBookScoreRow";
import { SongBookSectionRow } from "./SongBookSectionRow";
import type { ScoreEditUpdate } from "./ScoreEditModal";

export function SortableSongbookRow({ entry, index, sorting, insertion, emptySection, onDelete,
  onSelect, onPlay, onUpdate, onPrepareDrag }: {
  entry: SongbookEditorItem;
  index: number;
  sorting: boolean;
  emptySection: boolean;
  insertion?: "before" | "after";
  onDelete: () => void;
  onPrepareDrag: () => void;
  onSelect: (score: ScoreViewModel, checked: boolean) => void;
  onPlay: (part: PlayingPartViewModel) => void;
  onUpdate: (update: ScoreEditUpdate) => void;
}) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: entry.id,
    index,
    plugins: (defaults) => defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
  });
  const { item } = entry;
  const section = item.type === "section";
  const label = section ? `Mover seção ${item.title || "sem título"}` : `Mover música ${item.score.title}`;
  const handle = <DragHandle label={label} handleRef={handleRef} onPrepareDrag={onPrepareDrag} />;
  return (
    <tbody ref={ref} data-editor-id={entry.id} data-item-type={item.type}
      className={[
        "songbook-row-group",
        index % 2 === 0 ? "songbook-row-striped" : "",
        isDragSource ? "songbook-row-dragging" : "",
        insertion ? `songbook-insert-${insertion}` : "",
      ].join(" ")}>
      {section ? (
        <>
          <SongBookSectionRow title={item.title} dragHandle={handle} handleDelete={onDelete} />
          {emptySection && <tr className="songbook-empty-section"><td /><td colSpan={8}>
            Solte uma música após este título.
          </td></tr>}
        </>
      ) : (
        <SongBookScoreRow score={item.score} dragHandle={handle} hideDetails={sorting}
          handleDelete={onSelect} handlePlayingSong={onPlay} handleUpdateScore={onUpdate} />
      )}
    </tbody>
  );
}
