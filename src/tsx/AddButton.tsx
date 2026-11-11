import { BsCheckLg, BsPlusLg } from "react-icons/bs";

import "../css/ScoreRow.css";

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
      {added ? <BsCheckLg aria-hidden="true" /> : <BsPlusLg aria-hidden="true" />}
    </button>
  );
}
