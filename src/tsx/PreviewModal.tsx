import { Modal, Image, Carousel } from "react-bootstrap";
import { useEffect, useState } from "react";
import type { PartViewModel } from "../../types/viewModels";

import "../css/PreviewModal.css";
import RangeSlider from "react-bootstrap-range-slider";
import { BsFillPauseCircleFill, BsPlayCircleFill } from "react-icons/bs";
import { midiPlayer, playMidiPart, removeToastPlayer } from "../utils/playMidi";

interface PreviewModalProps {
  show: boolean;
  handleShow: (show: boolean) => void;
  part: PartViewModel;
}

interface SvgCarouselProps {
  svgs: string[];
}

const FilesCarousel = ({ svgs }: SvgCarouselProps) => {
  const [index, setIndex] = useState(0);

  const handleSelect = (selectedIndex: number) => {
    setIndex(selectedIndex);
  };
  return (
    <Carousel activeIndex={index} onSelect={handleSelect}>
      {svgs.map((svg) => (
        <Carousel.Item key={svg}>
          <Image src={svg} />
        </Carousel.Item>
      ))}
    </Carousel>
  );
};

const PreviewModal = ({ show, handleShow, part }: PreviewModalProps) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    removeToastPlayer();
  });

  const handleClose = () => {
    handleShow(false);
    midiPlayer?.stop();
  };

  const handlePlay = async () => {
    await playMidiPart(part.midi, part.instrument);
  };

  const handlePause = () => {
    midiPlayer?.pause();
  };

  const handleChange = (event: any) => {
    setValue(event.currentTarget.valueAsNumber);
    midiPlayer?.skipToPercent(event.currentTarget.valueAsNumber);
    midiPlayer?.play();
  };

  return (
    <Modal show={show} onHide={handleClose} backdrop="static" keyboard={false}>
      <Modal.Header closeButton>
        <Modal.Title>{part.instrument}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <RangeSlider
          className="slider"
          id="play-track-preview"
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
        <small id="song-time-preview"></small>
        <FilesCarousel svgs={part.svg} />
      </Modal.Body>
    </Modal>
  );
};

export { PreviewModal };
