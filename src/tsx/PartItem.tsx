import { AiFillEye } from "react-icons/ai";
import { BsFillPauseCircleFill, BsPlayCircleFill } from "react-icons/bs";

import type { ScoreViewModel, PlayingPartViewModel, PartViewModel } from "../../types/viewModels";

import "../css/PartItem.css";
import { SiMidi } from "react-icons/si";
import { midiPlayer, playMidiPart } from "../utils/playMidi";

interface PartItemProps {
  score: ScoreViewModel;
  part: PartViewModel;
  handlePlayingSong: (info: PlayingPartViewModel) => void;
  /** Opens the shared part-gallery modal at this part. */
  onOpenPreview: () => void;
}

const PartItem = ({ score, part, handlePlayingSong, onOpenPreview }: PartItemProps) => {
  const handlePlay = async () => {
    handlePlayingSong({ score, part });
    await playMidiPart(part.midi, part.instrument);
  };

  const handleStop = () => {
    midiPlayer?.stop();
  };

  return (
    <div className="instrument cursor part-item">
      <div className="part-item-name" onClick={onOpenPreview}>
        <AiFillEye className="visualize-icon" />
        <label>{part.instrument}</label>
      </div>
      <div className="part-item-actions">
        <BsPlayCircleFill
          className="play-icon-part"
          onClick={handlePlay}
        />
        <BsFillPauseCircleFill
          className="pause-icon-part"
          onClick={handleStop}
        />
        {part.midi != "" && (
          <a href={part.midi} target="_blank">
            <SiMidi />
          </a>
        )}
      </div>
    </div>
  );
};

export { PartItem };
