
import "./card/ScoreRow.css";

/**
 * A bold plus, 14px with 2px bars, on whole pixels: centered in the 28px
 * button (24px inside its border) it stays sharp and looks centered, where
 * a scaled icon fell between pixels and blurred to one side.
 */
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="0" y="6" width="14" height="2" rx="1" />
      <rect x="6" y="0" width="2" height="14" rx="1" />
    </svg>
  );
}

/** The check once added, drawn to match the plus: 14px, 2px rounded lines. */
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1.5,7.5 5.25,11.25 12.5,2.75" />
    </svg>
  );
}

/** Small discrete icon button shared by every "add to songbook" affordance. */
export function AddButton({
  label,
  addedLabel,
  onClick,
  disabled,
  added,
}: {
  label: string;
  addedLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  added?: boolean;
}) {
  return (
    <button
      type="button"
      className="score-add-button"
      aria-label={added ? (addedLabel ?? label) : label}
      title={added ? (addedLabel ?? label) : label}
      onClick={onClick}
      disabled={disabled || added}
    >
      {added ? <CheckIcon /> : <PlusIcon />}
    </button>
  );
}
