import type { Ref } from "react";

/** Three bars, from design/Asset 15.svg; drawn in the text color. */
function DragIcon() {
  return (
    <svg
      viewBox="0 0 25 17"
      width="1em"
      height={`${17 / 25}em`}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M23.5,7H1.5c-.83,0-1.5.67-1.5,1.5s.67,1.5,1.5,1.5h22c.83,0,1.5-.67,1.5-1.5s-.67-1.5-1.5-1.5Z" />
      <path d="M1.5,3h22c.83,0,1.5-.67,1.5-1.5s-.67-1.5-1.5-1.5H1.5C.67,0,0,.67,0,1.5s.67,1.5,1.5,1.5Z" />
      <path d="M23.5,14H1.5c-.83,0-1.5.67-1.5,1.5s.67,1.5,1.5,1.5h22c.83,0,1.5-.67,1.5-1.5s-.67-1.5-1.5-1.5Z" />
    </svg>
  );
}

export function DragHandle({ label, handleRef, onPrepareDrag }: {
  label: string;
  onPrepareDrag: (keyboard: boolean) => void;
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
        if (event.button === 0) { onPrepareDrag(false); }
      }}
      onKeyDownCapture={(event) => {
        if (!event.defaultPrevented && (event.key === " " || event.key === "Enter")) {
          onPrepareDrag(true);
        }
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <DragIcon />
    </button>
  );
}
