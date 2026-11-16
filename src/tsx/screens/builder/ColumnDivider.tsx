import { useEffect, useRef, type ReactNode } from "react";
import { BsChevronLeft, BsChevronRight } from "react-icons/bs";

/** Which Montar column is hidden, if any. */
export type CollapsedSide = "left" | "right" | null;

/**
 * The line between Resultados (left) and Caderninho (right). With both open
 * it offers to collapse either side; with one collapsed it sits at that edge
 * and offers to bring it back.
 */
export function ColumnDivider({
  collapsed,
  onChange,
  leftLabel,
  rightLabel,
}: {
  collapsed: CollapsedSide;
  onChange: (next: CollapsedSide) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  // The clicked button is replaced by another; keep keyboard focus on the
  // divider instead of dropping it back to the top of the page.
  const controls = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (refocus.current) {
      refocus.current = false;
      controls.current?.querySelector("button")?.focus();
    }
  }, [collapsed]);
  const change = (next: CollapsedSide) => {
    refocus.current = true;
    onChange(next);
  };

  return (
    <div className="column-divider">
      <div className="column-divider-controls" ref={controls}>
        {collapsed === null && (
          <>
            <DividerButton
              label={`Recolher ${leftLabel}`}
              onClick={() => change("left")}
            >
              <BsChevronLeft />
            </DividerButton>
            <DividerButton
              label={`Recolher ${rightLabel}`}
              onClick={() => change("right")}
            >
              <BsChevronRight />
            </DividerButton>
          </>
        )}
        {collapsed === "left" && (
          <DividerButton
            label={`Mostrar ${leftLabel}`}
            onClick={() => change(null)}
          >
            <BsChevronRight />
          </DividerButton>
        )}
        {collapsed === "right" && (
          <DividerButton
            label={`Mostrar ${rightLabel}`}
            onClick={() => change(null)}
          >
            <BsChevronLeft />
          </DividerButton>
        )}
      </div>
    </div>
  );
}

function DividerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="column-divider-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
