import type { ReactNode } from "react";
import { BsTriangleFill } from "react-icons/bs";
import { SiMidi, SiMusescore } from "react-icons/si";
import { PartItem } from "./PartItem";
import { LineageBadge } from "./LineageBadge";
import type { ScoreViewModel, PlayingPartViewModel } from "../../types/viewModels";

import "../css/ScoreRow.css";

interface ScoreCardProps {
  score: ScoreViewModel;
  mode: "compact" | "expanded";
  onToggleMode: () => void;
  onPlay: (info: PlayingPartViewModel) => void;
  /** Drag-handle cell, songbook column only. */
  leading?: ReactNode;
  /** Column-specific cell(s): delete+edit icons (songbook) or an Adicionar button (available). */
  trailing: ReactNode;
  /** Extra content shown only when expanded, above the part list — e.g. the project picker's version selector. */
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
  return (
    <>
      <tr className="cursor">
        {leading !== undefined && (
          <td className="songbook-handle-cell">{leading}</td>
        )}
        <td className="action-cell">
          <button
            type="button"
            className="btn btn-link p-0"
            aria-label={`${expanded ? "Recolher" : "Expandir"} ${score.title}`}
            aria-expanded={expanded}
            onClick={onToggleMode}
          >
            <BsTriangleFill
              aria-hidden="true"
              className={`arrow ${expanded ? "arrow-down" : "arrow-right"}`}
            />
          </button>
        </td>
        <td onClick={onToggleMode}>{score.title}</td>
        <td onClick={onToggleMode}>{score.projectTitle}</td>
        <td onClick={onToggleMode}>{score.tags.join(", ")}</td>
        {trailing}
        <td>
          {score.latestRevision.midi != "" && (
            <a href={score.latestRevision.midi} target="_blank" rel="noreferrer">
              <SiMidi />
            </a>
          )}
        </td>
        <td>
          {score.latestRevision.mscz != "" && (
            <a href={score.latestRevision.mscz} target="_blank" rel="noreferrer">
              <SiMusescore />
            </a>
          )}
        </td>
      </tr>
      {expanded && (
        <>
          <tr className="metadata-row">
            <td></td>
            <td colSpan={8} className="text-muted" style={{ fontSize: "0.85em" }}>
              <strong>Compositor:</strong> {score.composer || "(vazio)"} |{" "}
              <strong>Subtitulo:</strong> {score.sub || "(vazio)"} |{" "}
              <strong>Partes:</strong> {score.latestRevision.parts.length}
            </td>
          </tr>
          <tr>
            <td></td>
            <td colSpan={8}>
              <LineageBadge scoreId={score.id} />
            </td>
          </tr>
          {details}
          {score.latestRevision.parts.map((part) => (
            <PartItem
              key={part.name}
              score={score}
              part={part}
              handlePlayingSong={onPlay}
              colSpan={8}
            />
          ))}
        </>
      )}
    </>
  );
};

export { ScoreCard };
