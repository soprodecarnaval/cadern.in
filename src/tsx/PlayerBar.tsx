import { ToastContainer, Toast } from "react-bootstrap";
import "../css/SongBar.css";

import RangeSlider from "react-bootstrap-range-slider";
import { BsFillPauseCircleFill, BsPlayCircleFill } from "react-icons/bs";
import { useState } from "react";
import type { PlayingPartViewModel } from "../../types/viewModels";
import { midiPlayer } from "../utils/playMidi";

interface PlayerBarProps {
  info: PlayingPartViewModel | null;
}

const PlayerBar = ({ info }: PlayerBarProps) => {
  const [value, setValue] = useState(0);

  const handlePlay = () => {
    midiPlayer?.play();
  };

  const handlePause = () => {
    midiPlayer?.pause();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.valueAsNumber);
    midiPlayer?.skipToPercent(event.currentTarget.valueAsNumber);
    midiPlayer?.play();
  };

  return (
    <div id="play-bar-container" className="bar-container">
      <ToastContainer
        className="p-3"
        position={"bottom-center"}
        style={{ zIndex: 1 }}
      >
        <Toast>
          <Toast.Header>
            {info && (
              <>
                <strong className="me-auto">
                  {info.score.title} | {info.part.name}
                </strong>
                <small>{info.score.projectTitle}</small>
              </>
            )}
          </Toast.Header>
          <Toast.Body className="song">
            <RangeSlider
              className="slider"
              id="play-track"
              value={value}
              tooltip="off"
              onChange={handleChange}
            />
            <BsPlayCircleFill
              className="play-icon"
              size={18}
              onClick={handlePlay}
            />
            <BsFillPauseCircleFill
              className="pause-icon"
              size={18}
              onClick={handlePause}
            />
            <small id="song-time"></small>
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
};

export { PlayerBar as SongBar };
