import { useState } from "react";
import {
  BsTriangleFill,
  BsArrowDown,
  BsArrowUp,
  BsFillTrashFill,
  BsPencilFill,
} from "react-icons/bs";
import { SiMidi, SiMusescore } from "react-icons/si";

import type { Part, Score, PlayingPart } from "../../types";
import { PartItem } from "./PartItem";
import { ScoreEditModal } from "./ScoreEditModal";

import "../css/ScoreRow.css";

interface Props {
  handleDelete: (score: Score, checked: boolean) => void;
  handlePlayingSong: (score: PlayingPart) => void;
  handleMove: (steps: number) => void;
  handleUpdateScore: (updatedScore: Score) => void;
  score: Score;
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
          {score.midi != "" && (
            <a href={score.midi} target="_blank">
              <SiMidi />
            </a>
          )}
        </td>
        <td>
          {score.mscz && (
            <a href={score.mscz} target="_blank">
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
              <strong>Partes:</strong> {score.parts.length}
            </td>
          </tr>
          {score.parts.map((part: Part) => (
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
