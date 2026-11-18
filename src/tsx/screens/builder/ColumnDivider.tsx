import { useEffect, useRef } from "react";

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
              label={`Recolher ${rightLabel}`}
              points="right"
              onClick={() => change("right")}
            />
            <DividerButton
              label={`Recolher ${leftLabel}`}
              points="left"
              onClick={() => change("left")}
            />
          </>
        )}
        {collapsed === "left" && (
          <DividerButton
            label={`Mostrar ${leftLabel}`}
            points="right"
            onClick={() => change(null)}
          />
        )}
        {collapsed === "right" && (
          <DividerButton
            label={`Mostrar ${rightLabel}`}
            points="left"
            onClick={() => change(null)}
          />
        )}
      </div>
    </div>
  );
}

// The chevrons from the divider design (design/Asset 14.svg), each drawn
// across the full width of the line's strip so the line runs through its
// middle; the white fill hides the line inside the chevron.
const CHEVRONS = {
  right: {
    viewBox: "0 106.57 31.33 53",
    d: "M7.17,108.07l21.01,21.01c2.2,2.2,2.2,5.78,0,7.98l-21.01,21.01",
  },
  left: {
    viewBox: "0 160.34 31.33 53",
    d: "M24.16,211.84l-21.01-21.01c-2.2-2.2-2.2-5.78,0-7.98l21.01-21.01",
  },
};

function DividerButton({
  label,
  points,
  onClick,
}: {
  label: string;
  points: "left" | "right";
  onClick: () => void;
}) {
  const chevron = CHEVRONS[points];
  return (
    <button
      type="button"
      className="column-divider-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg viewBox={chevron.viewBox} aria-hidden="true">
        <path d={chevron.d} />
      </svg>
    </button>
  );
}
