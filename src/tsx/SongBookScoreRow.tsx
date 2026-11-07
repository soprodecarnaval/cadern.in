import { useState, type ReactNode } from "react";
import {
  BsTriangleFill,
  BsFillTrashFill,
  BsPencilFill,
} from "react-icons/bs";
import { SiMidi, SiMusescore } from "react-icons/si";

import type { ScoreViewModel, PlayingPartViewModel, PartViewModel } from "../../types/viewModels";
import { PartItem } from "./PartItem";
import { ScoreEditModal, type ScoreEditUpdate } from "./ScoreEditModal";

import "../css/ScoreRow.css";

interface Props {
  handleDelete: (score: ScoreViewModel, checked: boolean) => void;
  handlePlayingSong: (score: PlayingPartViewModel) => void;
  dragHandle: ReactNode;
  hideDetails: boolean;
  handleUpdateScore: (update: ScoreEditUpdate) => void;
  score: ScoreViewModel;
}

const SongBookScoreRow = ({
  handleDelete,
  score,
  handlePlayingSong,
  dragHandle,
  hideDetails,
  handleUpdateScore,
}: Props) => {
  const [expand, setExpand] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const onDelete = () => {
    handleDelete(score, false);
  };

  return (
    <>
      <tr className="cursor">
        <td className="songbook-handle-cell">{dragHandle}</td>
        <td className="action-cell">
          <button type="button" className="btn btn-link p-0"
            aria-label={`${expand ? "Recolher" : "Expandir"} ${score.title}`}
            aria-expanded={expand} onClick={() => setExpand(!expand)}>
            <BsTriangleFill aria-hidden="true" className={`arrow ${expand ? "arrow-down" : "arrow-right"}`} />
          </button>
        </td>
        <td onClick={() => setExpand(!expand)}>{score.title}</td>
        <td onClick={() => setExpand(!expand)}>{score.projectTitle}</td>
        <td onClick={() => setExpand(!expand)}>{score.tags.join(", ")}</td>
        <td>
          <BsFillTrashFill onClick={onDelete} />
        </td>
        <td>
          <BsPencilFill onClick={() => setShowEditModal(true)} />
        </td>
        <td>
          {score.latestRevision.midi != "" && (
            <a href={score.latestRevision.midi} target="_blank">
              <SiMidi />
            </a>
          )}
        </td>
        <td>
          {score.latestRevision.mscz && (
            <a href={score.latestRevision.mscz} target="_blank">
              <SiMusescore />
            </a>
          )}
        </td>
      </tr>
      {expand && !hideDetails && (
        <>
          <tr className="metadata-row">
            <td></td>
            <td colSpan={8} className="text-muted" style={{ fontSize: "0.85em" }}>
              <strong>Compositor:</strong> {score.composer || "(vazio)"} |{" "}
              <strong>Subtitulo:</strong> {score.sub || "(vazio)"} |{" "}
              <strong>Partes:</strong> {score.latestRevision.parts.length}
            </td>
          </tr>
          {score.latestRevision.parts.map((part: PartViewModel) => (
            <PartItem
              score={score}
              part={part}
              handlePlayingSong={handlePlayingSong}
              key={part.name}
              colSpan={9}
            />
          ))}
        </>
      )}
      <ScoreEditModal
        show={showEditModal}
        score={score}
        onHide={() => setShowEditModal(false)}
        onSave={handleUpdateScore}
      />
    </>
  );
};

export { SongBookScoreRow };
