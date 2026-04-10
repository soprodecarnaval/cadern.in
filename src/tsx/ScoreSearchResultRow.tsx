import { useState } from "react";
import { BsTriangleFill } from "react-icons/bs";

import { PartItem } from "./PartItem";

import "../css/ScoreRow.css";
import { SiMidi, SiMusescore } from "react-icons/si";
import { LegacyScore, PlayingPart } from "../../types";

interface ScoreSearchResultRowProps {
  handleSelect: (score: LegacyScore, checked: boolean) => void;
  handlePlayingSong: (score: PlayingPart) => void;
  score: LegacyScore;
}

const ScoreSearchResultRow = ({
  handleSelect,
  score,
  handlePlayingSong,
}: ScoreSearchResultRowProps) => {
  const [expand, setExpand] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleOnChange = () => {
    handleSelect(score, !checked);
    setChecked(!checked);
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
        <td onClick={handleOnChange}>{score.title}</td>
        <td onClick={handleOnChange}>{score.projectTitle}</td>
        <td onClick={handleOnChange}>{score.tags}</td>
        <td>
          {score.midi != "" && (
            <a href={score.midi} target="_blank">
              <SiMidi />
            </a>
          )}
        </td>
        <td>
          {score.mscz != "" && (
            <a href={score.mscz} target="_blank">
              <SiMusescore />
            </a>
          )}
        </td>
      </tr>
      {expand &&
        score.parts.map((part) => (
          <PartItem
            score={score}
            part={part}
            handlePlayingSong={handlePlayingSong}
            key={part.name}
          />
        ))}
    </>
  );
};

export { ScoreSearchResultRow as ArrangementItem };
