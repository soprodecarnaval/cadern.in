import { Button, Modal, Image, Carousel } from "react-bootstrap";
import { useEffect, useState, type ChangeEvent } from "react";
import type { PartViewModel } from "../../types/viewModels";

import "../css/PreviewModal.css";
import RangeSlider from "react-bootstrap-range-slider";
import { BsChevronLeft, BsChevronRight, BsFillPauseCircleFill, BsPlayCircleFill } from "react-icons/bs";
import { midiPlayer, playMidiPart, removeToastPlayer } from "../utils/playMidi";

interface PreviewModalProps {
  show: boolean;
  handleShow: (show: boolean) => void;
  parts: PartViewModel[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
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
    // Keyboard is reserved for switching parts (below) — intra-part page
    // paging uses the carousel's own click/dot controls only, so the two
    // don't both react to the same arrow keypress.
    <Carousel activeIndex={index} onSelect={handleSelect} keyboard={false}>
      {svgs.map((svg) => (
        <Carousel.Item key={svg}>
          <Image src={svg} />
        </Carousel.Item>
      ))}
    </Carousel>
  );
};

const PreviewModal = ({ show, handleShow, parts, activeIndex, onIndexChange }: PreviewModalProps) => {
  const [value, setValue] = useState(0);
  const part = parts[activeIndex];

  useEffect(() => {
    removeToastPlayer();
  });

  useEffect(() => {
    if (!show) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && activeIndex > 0) {
        onIndexChange(activeIndex - 1);
      } else if (event.key === "ArrowRight" && activeIndex < parts.length - 1) {
        onIndexChange(activeIndex + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, activeIndex, parts.length, onIndexChange]);

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

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.valueAsNumber);
    midiPlayer?.skipToPercent(event.currentTarget.valueAsNumber);
    midiPlayer?.play();
  };

  if (!part) {
    return null;
  }

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
        {parts.length > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-2">
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={activeIndex === 0}
              onClick={() => onIndexChange(activeIndex - 1)}
            >
              <BsChevronLeft aria-hidden="true" /> Anterior
            </Button>
            <span className="text-muted small">
              {activeIndex + 1} / {parts.length}
            </span>
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={activeIndex === parts.length - 1}
              onClick={() => onIndexChange(activeIndex + 1)}
            >
              Próxima <BsChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export { PreviewModal };
