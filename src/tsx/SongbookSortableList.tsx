import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useDroppable, type DragEndEvent, type DragStartEvent, type DragMoveEvent, type DragOverEvent } from "@dnd-kit/react";
import type { ScoreViewModel, SongbookItemViewModel } from "../../types/viewModels";
import { insertionIndex, moveSongbookEntry, songbookDragRange, songbookSectionRange } from "../lib/songbookReorder";
import { destinationForIncomingScore, SONGBOOK_APPEND_ID } from "../lib/crossColumnDnd";
import { useSongbookEditorItems } from "../lib/useSongbookEditorItems";
import { SortableSongbookRow } from "./SortableSongbookRow";
import type { ScoreEditUpdate } from "./ScoreEditModal";
import "../css/SongbookSortableList.css";

interface DropPosition {
  target: string;
  edge: "before" | "after";
  index: number;
  boundary: number;
}

/** Imperatively driven by SongbookDragProvider, which owns the single shared
 * DragDropProvider spanning this list and the available-scores column. */
export interface SongbookSortableListHandle {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  /** Where an incoming (not-yet-in-list) score should land, given the drop target. */
  resolveIncomingDrop: (operation: DragEndEvent["operation"]) => number;
  label: (id: string | number | undefined) => string;
  instructions: Record<string, string>;
  announcements: {
    dragstart: (event: DragStartEvent) => string;
    dragover: (event: DragOverEvent) => string | undefined;
    dragend: (event: DragEndEvent) => string;
  };
}

function EmptySongbookDropzone() {
  const { ref } = useDroppable({ id: SONGBOOK_APPEND_ID, data: { group: "songbook" } });
  return (
    <div ref={ref} className="songbook-empty-list text-muted py-3">
      Adicione músicas ou seções para montar o caderninho.
    </div>
  );
}

export const SongbookSortableList = forwardRef<SongbookSortableListHandle, {
  Card: import("react").ComponentType<import("./ScoreCardView").ScoreCardProps>;
  rows: SongbookItemViewModel[];
  onReorder: (rows: SongbookItemViewModel[]) => void;
  onDelete: (index: number) => void;
  onSelect: (score: ScoreViewModel, checked: boolean) => void;
  onUpdate: (index: number, update: ScoreEditUpdate) => void;
}>(function SongbookSortableList({ Card, rows, onReorder, onDelete, onSelect, onUpdate }, ref) {
  const entries = useSongbookEditorItems(rows);
  const container = useRef<HTMLDivElement>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState(false);
  const [drop, setDrop] = useState<DropPosition | null>(null);
  const draggedIndex = entries.findIndex((entry) => entry.id === (activeId ?? preparingId));
  const draggedRange = songbookDragRange(rows, draggedIndex);
  const sectionDrag = rows[draggedIndex]?.type === "section";
  const carried = (index: number) => draggedRange !== null &&
    index >= draggedRange.start && index < draggedRange.end;

  useEffect(() => {
    if (!preparingId) { return; }
    const finish = () => setPreparingId(null);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("blur", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", finish);
    };
  }, [preparingId]);

  const prepareDrag = (id: string, keyboard: boolean) => {
    if (!activeId) {
      // Native sensors measure on the handle's event. React capture runs
      // first, so compact the rows before those measurements are taken.
      flushSync(() => {
        setPreparingId(id);
        setKeyboardDrag(keyboard);
      });
    }
  };
  const label = (id: string | number | undefined) => {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) { return "Item"; }
    if (entry.item.type !== "section") { return entry.item.score.title; }
    const range = songbookDragRange(rows, entries.indexOf(entry))!;
    const count = range.end - range.start - 1;
    return `Seção ${entry.item.title || "sem título"} · ${count} música${count === 1 ? "" : "s"}`;
  };

  /** Direct children of the list container, keyed by data-editor-id — one per
   * entry (score card or section), matching SortableSongbookRow's outer div. */
  const entryElements = () => [...(container.current?.children ?? [])] as HTMLElement[];

  const destination = (operation: DragEndEvent["operation"]): DropPosition | null => {
    const { source, target, position, activatorEvent } = operation;
    if (!source || !target || source.id === target.id) { return null; }
    const from = entries.findIndex((entry) => entry.id === source.id);
    const to = entries.findIndex((entry) => entry.id === target.id);
    if (from < 0 || to < 0) { return null; }
    const keyboard = activatorEvent instanceof KeyboardEvent;
    const point = position.current;
    const bounds = container.current?.getBoundingClientRect();
    if (!keyboard && (!bounds || point.x < bounds.left || point.x > bounds.right ||
      point.y < bounds.top || point.y > bounds.bottom)) { return null; }
    const range = songbookDragRange(rows, from)!;
    if (to >= range.start && to < range.end) { return null; }
    if (rows[from].type === "section") {
      const group = songbookSectionRange(rows, to)!;
      const elements = entryElements();
      const first = elements.find((el) => el.dataset.editorId === entries[group.start].id);
      const last = elements.find((el) => el.dataset.editorId === entries[group.end - 1].id);
      if (!first || !last) { return null; }
      const top = first.getBoundingClientRect().top;
      const bottom = last.getBoundingClientRect().bottom;
      const edge = rows[group.start].type !== "section" ? "after"
        : keyboard ? (to > from ? "after" : "before")
        : point.y >= (top + bottom) / 2 ? "after" : "before";
      const boundary = edge === "after" ? group.end : group.start;
      if (boundary >= range.start && boundary <= range.end) { return null; }
      return {
        target: entries[edge === "after" ? group.end - 1 : group.start].id,
        edge,
        boundary,
        index: boundary > range.end ? boundary - (range.end - range.start) : boundary,
      };
    }
    const targetBounds = target.element?.getBoundingClientRect();
    if (!targetBounds) { return null; }
    const edge = keyboard ? (to > from ? "after" : "before")
      : point.y >= targetBounds.top + targetBounds.height / 2 ? "after" : "before";
    return {
      target: String(target.id), edge, index: insertionIndex(from, to, edge),
      boundary: to + (edge === "after" ? 1 : 0),
    };
  };

  /** Where an incoming score (not yet in `rows`) should land — same edge
   * geometry as destination(), without the from/carried-range exclusion. */
  const resolveIncomingDrop = (operation: DragEndEvent["operation"]): number => {
    const target = operation.target;
    if (!target || target.id === SONGBOOK_APPEND_ID) { return rows.length; }
    const to = entries.findIndex((entry) => entry.id === target.id);
    if (to < 0) { return rows.length; }
    const point = operation.position.current;
    if (rows[to].type === "section") {
      const group = songbookSectionRange(rows, to)!;
      const elements = entryElements();
      const first = elements.find((el) => el.dataset.editorId === entries[group.start].id);
      const last = elements.find((el) => el.dataset.editorId === entries[group.end - 1].id);
      const top = first?.getBoundingClientRect().top ?? 0;
      const bottom = last?.getBoundingClientRect().bottom ?? 0;
      const edge = rows[group.start].type !== "section" ? "after"
        : point.y >= (top + bottom) / 2 ? "after" : "before";
      return destinationForIncomingScore(rows, entries, target.id, edge);
    }
    const targetBounds = target.element?.getBoundingClientRect();
    const edge = targetBounds && point.y >= targetBounds.top + targetBounds.height / 2 ? "after" : "before";
    return destinationForIncomingScore(rows, entries, target.id, edge);
  };

  const placement = (operation: DragEndEvent["operation"], next: DropPosition) => {
    const from = entries.findIndex((entry) => entry.id === operation.source?.id);
    if (rows[from]?.type !== "section") {
      return `posição ${next.index + 1} de ${entries.length}`;
    }
    const before = rows.slice(0, next.boundary).filter((row) => row.type === "section").length;
    const ordinal = before - (from < next.boundary ? 1 : 0) + 1;
    const total = rows.filter((row) => row.type === "section").length;
    return `posição ${ordinal} de ${total} seções`;
  };

  const updateDrop = (operation: DragEndEvent["operation"]) => {
    const next = destination(operation);
    setDrop((previous) => previous?.target === next?.target && previous?.edge === next?.edge &&
      previous?.index === next?.index ? previous : next);
  };

  const instructions = useMemo(() => ({
    draggable: "Para mover, pressione Espaço. Use as setas para escolher a posição, Espaço para soltar e Escape para cancelar.",
  }), []);

  const announcements = {
    dragstart: ({ operation }: DragStartEvent) => `Movendo ${label(operation.source?.id)}.`,
    dragover: ({ operation }: DragOverEvent) => {
      const next = destination(operation);
      return next ? `${label(operation.source?.id)}, ${placement(operation, next)}.` : undefined;
    },
    dragend: ({ operation, canceled }: DragEndEvent) => canceled || !destination(operation)
      ? "Movimento cancelado."
      : `${label(operation.source?.id)}: ${placement(operation, destination(operation)!)}.`,
  };

  const handleDragStart = ({ operation }: DragStartEvent) => {
    setActiveId(operation.source ? String(operation.source.id) : null);
    setKeyboardDrag(operation.activatorEvent instanceof KeyboardEvent);
    setPreparingId(null);
  };
  const handleDragMove = ({ operation }: DragMoveEvent) => updateDrop(operation);
  const handleDragOver = ({ operation }: DragOverEvent) => updateDrop(operation);
  const handleDragEnd = ({ operation, canceled }: DragEndEvent) => {
    const next = !canceled ? destination(operation) : null;
    if (next && operation.source) {
      const from = entries.findIndex((entry) => entry.id === operation.source?.id);
      const reordered = moveSongbookEntry(rows, from, next.boundary);
      if (reordered !== rows) { onReorder(reordered); }
    }
    setActiveId(null);
    setPreparingId(null);
    setKeyboardDrag(false);
    setDrop(null);
  };

  useImperativeHandle(ref, () => ({
    handleDragStart, handleDragMove, handleDragOver, handleDragEnd,
    resolveIncomingDrop, label, instructions, announcements,
  }));

  return (
    <>
      <p className="songbook-tip text-muted small lh-sm">
        Arraste pela alça. Seções levam suas músicas. Teclado: Espaço, setas e Escape.
      </p>
      <div ref={container} className="songbook-card-list" role="list"
        aria-label="Músicas e seções do caderninho">
        {entries.map((entry, index) => (
          <SortableSongbookRow Card={Card} key={entry.id} entry={entry} index={index}
            sorting={!sectionDrag && carried(index)}
            carried={activeId !== null && carried(index)}
            disableDrop={sectionDrag && ((carried(index) && index !== draggedIndex) ||
              (keyboardDrag && entry.item.type === "score"))}
            scoreCount={entry.item.type === "section" ? songbookDragRange(rows, index)!.end - index - 1 : 0}
            emptySection={entry.item.type === "section" && (!entries[index + 1] || entries[index + 1].item.type === "section")}
            insertion={drop?.target === entry.id ? drop.edge : undefined}
            onPrepareDrag={(keyboard) => prepareDrag(entry.id, keyboard)}
            onDelete={() => onDelete(index)} onSelect={onSelect}
            onUpdate={(update) => onUpdate(index, update)} />
        ))}
        {entries.length === 0 && <EmptySongbookDropzone />}
      </div>
    </>
  );
});
