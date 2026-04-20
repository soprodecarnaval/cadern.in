import { useState } from "react";
import {
  BsTriangleFill,
  BsArrowDown,
  BsArrowUp,
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
  handleMove: (steps: number) => void;
  handleUpdateScore: (update: ScoreEditUpdate) => void;
  score: ScoreViewModel;
}

const SongBookScoreRow = ({
  handleDelete,
  score,
  handlePlayingSong,
  handleMove,
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
        <td className="action-cell">
          <BsTriangleFill
            onClick={() => setExpand(!expand)}
            className={`arrow ${expand ? "arrow-down" : "arrow-right"}`}
          />
        </td>
        <td onClick={() => setExpand(!expand)}>{score.title}</td>
        <td onClick={() => setExpand(!expand)}>{score.projectTitle}</td>
        <td onClick={() => setExpand(!expand)}>{score.tags.join(", ")}</td>
        <td>
          <BsArrowUp onClick={() => handleMove(-1)} />
        </td>
        <td>
          <BsArrowDown onClick={() => handleMove(1)} />
        </td>
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
      {expand && (
        <>
          <tr className="metadata-row">
            <td></td>
            <td colSpan={9} className="text-muted" style={{ fontSize: "0.85em" }}>
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
