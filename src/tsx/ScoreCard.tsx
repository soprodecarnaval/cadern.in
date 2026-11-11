import { useState, type ReactNode } from "react";
import { BsChevronDown, BsChevronRight, BsEye } from "react-icons/bs";
import { SiMidi, SiMusescore } from "react-icons/si";
import { CardLineage } from "./CardLineage";
import { ScoreDetailModal } from "./ScoreDetailModal";
import { highlightRanges, type HighlightRanges } from "../lib/highlight";
import type { ScoreViewModel } from "../../types/viewModels";

import "../css/ScoreRow.css";

/** Per-field search-match ranges — library cards only (see ScoreCard's `highlight` prop). */
export interface ScoreCardHighlight {
  title?: HighlightRanges;
  projectTitle?: HighlightRanges;
  composer?: HighlightRanges;
  tags?: HighlightRanges;
}

interface ScoreCardProps {
  score: ScoreViewModel;
  mode: "compact" | "expanded";
  onToggleMode: () => void;
  /** Drag-handle, songbook column only. */
  leading?: ReactNode;
  /** Column-specific action(s): delete+edit (songbook) or an add button (available). */
  trailing: ReactNode;
  /** Extra content shown only when expanded — e.g. the project picker's version selector. */
  details?: ReactNode;
  /** Search-match ranges to highlight — only ever passed for library/available cards. */
  highlight?: ScoreCardHighlight;
}

const ScoreCard = ({
  score,
  mode,
  onToggleMode,
  leading,
  trailing,
  details,
  highlight,
}: ScoreCardProps) => {
  const expanded = mode === "expanded";
  const parts = score.latestRevision.parts;
  const [showDetail, setShowDetail] = useState(false);
  // Field priority: title → owning project (stand-in for "first published
  // songbook" until that data exists) → composer → tags.
  const metaFields: { text: string; ranges?: HighlightRanges }[] = [
    { text: score.projectTitle, ranges: highlight?.projectTitle },
    ...(score.composer ? [{ text: score.composer, ranges: highlight?.composer }] : []),
    ...(score.tags.length > 0
      ? [{ text: score.tags.join(", "), ranges: highlight?.tags }]
      : []),
  ];

  return (
    <div className="score-card">
      <div className="score-card-row">
        {leading}
        <button
          type="button"
          className="btn btn-link p-0 score-card-toggle"
          aria-label={`${expanded ? "Recolher" : "Expandir"} ${score.title}`}
          aria-expanded={expanded}
          onClick={onToggleMode}
        >
          {expanded ? (
            <BsChevronDown aria-hidden="true" />
          ) : (
            <BsChevronRight aria-hidden="true" />
          )}
        </button>
        <div className="score-card-main" onClick={onToggleMode}>
          <div className="score-card-title">{highlightRanges(score.title, highlight?.title)}</div>
          {metaFields.length > 0 && (
            <div className="score-card-meta text-muted small">
              {metaFields.map((field, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {highlightRanges(field.text, field.ranges)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="score-card-links">
          <button
            type="button"
            className="btn btn-link p-0"
            aria-label={`Ver detalhes de ${score.title}`}
            onClick={() => setShowDetail(true)}
          >
            <BsEye aria-hidden="true" />
          </button>
          {score.latestRevision.midi != "" && (
            <a href={score.latestRevision.midi} target="_blank" rel="noreferrer" aria-label="MIDI">
              <SiMidi />
            </a>
          )}
          {score.latestRevision.mscz != "" && (
            <a href={score.latestRevision.mscz} target="_blank" rel="noreferrer" aria-label="MuseScore">
              <SiMusescore />
            </a>
          )}
        </div>
        {trailing}
      </div>
      {expanded && (
        <div className="score-card-details">
          {(score.sub || parts.length > 0) && (
            <div className="text-muted small score-card-subline">
              {score.sub && <>{score.sub} · </>}
              {parts.length} parte{parts.length === 1 ? "" : "s"}
            </div>
          )}
          <CardLineage scoreId={score.id} />
          {details}
          <div className="score-card-parts">
            {parts.map((part) => (
              <span key={part.name} className="badge rounded-pill text-bg-light border">
                {part.instrument}
              </span>
            ))}
          </div>
        </div>
      )}
      <ScoreDetailModal
        show={showDetail}
        scoreId={score.id}
        onHide={() => setShowDetail(false)}
      />
    </div>
  );
};

export { ScoreCard };
