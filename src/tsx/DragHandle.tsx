import type { Ref } from "react";
import { BsGripVertical } from "react-icons/bs";

export function DragHandle({ label, handleRef, onPrepareDrag }: {
  label: string;
  onPrepareDrag: () => void;
  handleRef: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={handleRef}
      type="button"
      className="songbook-drag-handle"
      aria-label={label}
      title="Arraste para mover; use Espaço e as setas pelo teclado"
      onPointerDownCapture={(event) => {
        if (event.button === 0) { onPrepareDrag(); }
      }}
      onKeyDownCapture={(event) => {
        if (!event.defaultPrevented && (event.key === " " || event.key === "Enter")) {
          onPrepareDrag();
        }
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <BsGripVertical aria-hidden="true" />
    </button>
  );
}
