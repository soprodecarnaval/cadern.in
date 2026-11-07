import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Table } from "react-bootstrap";
import { DragDropProvider, DragOverlay, type DragEndEvent, type DragStartEvent, type DragOverEvent } from "@dnd-kit/react";
import { Accessibility, KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import type { PlayingPartViewModel, ScoreViewModel, SongbookItemViewModel } from "../../types/viewModels";
import { insertionIndex, reorderSongbookItems } from "../lib/songbookReorder";
import { useSongbookEditorItems } from "../lib/useSongbookEditorItems";
import { SortableSongbookRow } from "./SortableSongbookRow";
import type { ScoreEditUpdate } from "./ScoreEditModal";
import "../css/SongbookSortableList.css";

const sensors = [
  PointerSensor.configure({
    activationConstraints: (event) => event.pointerType === "touch"
      ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: 8 })]
      : [new PointerActivationConstraints.Distance({ value: 6 })],
  }),
  KeyboardSensor,
];

interface DropPosition {
  target: string;
  edge: "before" | "after";
  index: number;
}

export function SongbookSortableList({ rows, onReorder, onDelete, onSelect, onPlay, onUpdate }: {
  rows: SongbookItemViewModel[];
  onReorder: (rows: SongbookItemViewModel[]) => void;
  onDelete: (index: number) => void;
  onSelect: (score: ScoreViewModel, checked: boolean) => void;
  onPlay: (part: PlayingPartViewModel) => void;
  onUpdate: (index: number, update: ScoreEditUpdate) => void;
}) {
  const entries = useSongbookEditorItems(rows);
  const table = useRef<HTMLTableElement>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropPosition | null>(null);
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

  const prepareDrag = (id: string) => {
    if (!activeId) {
      // Native sensors measure on the handle's event. React capture runs
      // first, so compact the rows before those measurements are taken.
      flushSync(() => setPreparingId(id));
    }
  };
  const label = (id: string | number | undefined) => {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) { return "Item"; }
    return entry.item.type === "section"
      ? `Seção ${entry.item.title || "sem título"}` : entry.item.score.title;
  };

  const destination = (operation: DragEndEvent["operation"]): DropPosition | null => {
    const { source, target, position, activatorEvent } = operation;
    if (!source || !target || source.id === target.id) { return null; }
    const from = entries.findIndex((entry) => entry.id === source.id);
    const to = entries.findIndex((entry) => entry.id === target.id);
    if (from < 0 || to < 0) { return null; }
    const keyboard = activatorEvent instanceof KeyboardEvent;
    const point = position.current;
    const bounds = table.current?.getBoundingClientRect();
    if (!keyboard && (!bounds || point.x < bounds.left || point.x > bounds.right ||
      point.y < bounds.top || point.y > bounds.bottom)) { return null; }
    const targetBounds = target.element?.getBoundingClientRect();
    if (!targetBounds) { return null; }
    const edge = keyboard ? (to > from ? "after" : "before")
      : point.y >= targetBounds.top + targetBounds.height / 2 ? "after" : "before";
    return { target: String(target.id), edge, index: insertionIndex(from, to, edge) };
  };

  const updateDrop = (operation: DragEndEvent["operation"]) => {
    const next = destination(operation);
    setDrop((previous) => previous?.target === next?.target && previous?.edge === next?.edge &&
      previous?.index === next?.index ? previous : next);
  };

  const instructions = useMemo(() => ({
    draggable: "Para mover, pressione Espaço. Use as setas para escolher a posição, Espaço para soltar e Escape para cancelar.",
  }), []);

  return (
    <DragDropProvider sensors={sensors}
      plugins={(defaults) => [
        ...defaults.filter((plugin) => plugin !== Accessibility),
        Accessibility.configure({
          screenReaderInstructions: instructions,
          announcements: {
            dragstart: ({ operation }: DragStartEvent) => `${label(operation.source?.id)} selecionado para mover.`,
            dragover: ({ operation }: DragOverEvent) => {
              const next = destination(operation);
              return next ? `${label(operation.source?.id)}, posição ${next.index + 1} de ${entries.length}.` : undefined;
            },
            dragend: ({ operation, canceled }: DragEndEvent) => canceled || !destination(operation)
              ? "Movimento cancelado."
              : `${label(operation.source?.id)} movido para a posição ${destination(operation)!.index + 1}.`,
          },
        }),
      ]}
      onDragStart={({ operation }) => {
        setActiveId(operation.source ? String(operation.source.id) : null);
        setPreparingId(null);
      }}
      onDragMove={({ operation }) => updateDrop(operation)}
      onDragOver={({ operation }) => updateDrop(operation)}
      onDragEnd={({ operation, canceled }) => {
        const next = !canceled ? destination(operation) : null;
        if (next && operation.source) {
          const from = entries.findIndex((entry) => entry.id === operation.source?.id);
          const reordered = reorderSongbookItems(rows, from, next.index);
          if (reordered !== rows) { onReorder(reordered); }
        }
        setActiveId(null);
        setPreparingId(null);
        setDrop(null);
      }}>
      <p className="text-muted small mt-2 mb-1">
        Arraste pela alça para reordenar. Teclado: Espaço, setas e Escape.
      </p>
      <div className="table-responsive">
        <Table ref={table} borderless hover className="songbook-sortable-table"
          aria-label="Músicas e seções do caderninho">
          <thead>
            <tr>
              <th><span className="visually-hidden">Mover</span></th>
              <th><span className="visually-hidden">Expandir</span></th>
              <th>Título</th><th>Arranjo</th><th>Tags</th>
              <th><span className="visually-hidden">Remover</span></th>
              <th><span className="visually-hidden">Editar</span></th>
              <th><span className="visually-hidden">MIDI</span></th>
              <th><span className="visually-hidden">MuseScore</span></th>
            </tr>
          </thead>
          {entries.map((entry, index) => (
            <SortableSongbookRow key={entry.id} entry={entry} index={index}
              sorting={activeId === entry.id || preparingId === entry.id}
              emptySection={entry.item.type === "section" && (!entries[index + 1] || entries[index + 1].item.type === "section")}
              insertion={drop?.target === entry.id ? drop.edge : undefined}
              onPrepareDrag={() => prepareDrag(entry.id)}
              onDelete={() => onDelete(index)} onSelect={onSelect} onPlay={onPlay}
              onUpdate={(update) => onUpdate(index, update)} />
          ))}
          {entries.length === 0 && <tbody><tr><td colSpan={9} className="text-muted py-3">
            Adicione músicas ou seções para montar o caderninho.
          </td></tr></tbody>}
        </Table>
      </div>
      <DragOverlay dropAnimation={null}>
        {(source) => <div className="songbook-drag-preview" aria-hidden="true">{label(source.id)}</div>}
      </DragOverlay>
    </DragDropProvider>
  );
}
