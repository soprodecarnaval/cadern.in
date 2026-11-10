import type { ReactNode, RefObject } from "react";
import { DragDropProvider, DragOverlay, type DragEndEvent, type DragStartEvent, type DragMoveEvent, type DragOverEvent } from "@dnd-kit/react";
import { Accessibility, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import type { ScoreViewModel } from "../../types/viewModels";
import type { DndGroup } from "../lib/crossColumnDnd";
import { SongbookKeyboardSensor } from "../lib/songbookKeyboardSensor";
import type { SongbookSortableListHandle } from "./SongbookSortableList";
import "../css/SongbookSortableList.css";

const sensors = [
  PointerSensor.configure({
    activationConstraints: (event) => event.pointerType === "touch"
      ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: 8 })]
      : [new PointerActivationConstraints.Distance({ value: 6 })],
  }),
  SongbookKeyboardSensor,
];

/**
 * The single shared DragDropProvider spanning the available-scores column
 * and the songbook column. Within-songbook reorder (including whole-section
 * carrying) is delegated verbatim to SongbookSortableList via its imperative
 * handle; this component only handles the cross-column add/remove case.
 */
export function SongbookDragProvider({ songbookRef, onAddAt, onRemove, children }: {
  songbookRef: RefObject<SongbookSortableListHandle | null>;
  onAddAt: (score: ScoreViewModel, index: number) => void;
  onRemove: (score: ScoreViewModel) => void;
  children: ReactNode;
}) {
  const groupOf = (entity: { data?: unknown } | null | undefined): DndGroup | undefined =>
    (entity?.data as { group?: DndGroup } | undefined)?.group;

  const handleDragEnd = (event: DragEndEvent) => {
    const { operation, canceled } = event;
    const sourceGroup = groupOf(operation.source);
    const targetGroup = groupOf(operation.target);
    if (sourceGroup === "songbook" && targetGroup === "songbook") {
      songbookRef.current?.handleDragEnd(event);
      return;
    }
    if (canceled || !operation.source || !targetGroup || sourceGroup === targetGroup) {
      return;
    }
    const score = (operation.source.data as { score?: ScoreViewModel }).score;
    if (!score) { return; }
    if (sourceGroup === "available" && targetGroup === "songbook") {
      onAddAt(score, songbookRef.current?.resolveIncomingDrop(operation) ?? 0);
    } else if (sourceGroup === "songbook" && targetGroup === "available") {
      onRemove(score);
    }
  };

  return (
    <DragDropProvider
      sensors={sensors}
      plugins={(defaults) => [
        ...defaults.filter((plugin) => plugin !== Accessibility),
        Accessibility.configure({
          screenReaderInstructions: songbookRef.current?.instructions ?? {
            draggable: "Para mover, pressione Espaço.",
          },
          announcements: {
            dragstart: (event: DragStartEvent) =>
              songbookRef.current?.announcements.dragstart(event) ?? "Movendo item.",
            dragover: (event: DragOverEvent) => {
              const sourceGroup = groupOf(event.operation.source);
              const targetGroup = groupOf(event.operation.target);
              return sourceGroup === "songbook" && targetGroup === "songbook"
                ? songbookRef.current?.announcements.dragover(event)
                : undefined;
            },
            dragend: (event: DragEndEvent) => {
              const sourceGroup = groupOf(event.operation.source);
              const targetGroup = groupOf(event.operation.target);
              if (sourceGroup === "songbook" && targetGroup === "songbook") {
                return songbookRef.current?.announcements.dragend(event) ?? "Movimento cancelado.";
              }
              if (event.canceled || !targetGroup || sourceGroup === targetGroup) {
                return "Movimento cancelado.";
              }
              return sourceGroup === "available"
                ? "Adicionado ao caderninho."
                : "Removido do caderninho.";
            },
          },
        }),
      ]}
      onDragStart={(event: DragStartEvent) => songbookRef.current?.handleDragStart(event)}
      onDragMove={(event: DragMoveEvent) => songbookRef.current?.handleDragMove(event)}
      onDragOver={(event: DragOverEvent) => songbookRef.current?.handleDragOver(event)}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {(source) => {
          const data = source.data as { group?: DndGroup; score?: ScoreViewModel };
          const text = data.group === "songbook"
            ? songbookRef.current?.label(source.id)
            : data.score?.title;
          return <div className="songbook-drag-preview" aria-hidden="true">{text ?? "Item"}</div>;
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
