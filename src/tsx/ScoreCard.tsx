import { useState, type ReactNode } from "react";
import { BsChevronDown, BsChevronRight } from "react-icons/bs";
import { SiMidi, SiMusescore } from "react-icons/si";
import { PartItem } from "./PartItem";
import { PreviewModal } from "./PreviewModal";
import { LineageBadge } from "./LineageBadge";
import type { ScoreViewModel, PlayingPartViewModel } from "../../types/viewModels";

import "../css/ScoreRow.css";

interface ScoreCardProps {
  score: ScoreViewModel;
  mode: "compact" | "expanded";
  onToggleMode: () => void;
  onPlay: (info: PlayingPartViewModel) => void;
  /** Drag-handle, songbook column only. */
  leading?: ReactNode;
  /** Column-specific action(s): delete+edit (songbook) or an add button (available). */
  trailing: ReactNode;
  /** Extra content shown only when expanded — e.g. the project picker's version selector. */
  details?: ReactNode;
}

const ScoreCard = ({
  score,
  mode,
  onToggleMode,
  onPlay,
  leading,
  trailing,
  details,
}: ScoreCardProps) => {
  const expanded = mode === "expanded";
  const parts = score.latestRevision.parts;
  const previewableParts = parts.filter((p) => p.svg.length > 0);
  const [openPartIndex, setOpenPartIndex] = useState<number | null>(null);
  // Field priority: title → owning project (stand-in for "first published
  // songbook" until that data exists) → composer → tags.
  const metaLine = [
    score.projectTitle,
    score.composer || undefined,
    score.tags.length > 0 ? score.tags.join(", ") : undefined,
  ]
    .filter((part): part is string => !!part)
    .join(" · ");

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
          <div className="score-card-title">{score.title}</div>
          {metaLine && <div className="score-card-meta text-muted small">{metaLine}</div>}
        </div>
        <div className="score-card-links">
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
          <LineageBadge scoreId={score.id} />
          {details}
          <div className="score-card-parts">
            {previewableParts.map((part, i) => (
              <PartItem
                key={part.name}
                score={score}
                part={part}
                handlePlayingSong={onPlay}
                onOpenPreview={() => setOpenPartIndex(i)}
              />
            ))}
          </div>
        </div>
      )}
      {openPartIndex !== null && (
        <PreviewModal
          show
          handleShow={(show) => setOpenPartIndex(show ? openPartIndex : null)}
          parts={previewableParts}
          activeIndex={openPartIndex}
          onIndexChange={setOpenPartIndex}
        />
      )}
    </div>
  );
};

export { ScoreCard };
