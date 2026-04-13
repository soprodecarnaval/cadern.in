import { Modal } from "react-bootstrap";
import type { SongBook } from "../../types/songbook";
import { useState } from "react";

// GUS-TODO: save whole songbook instead of just rows
interface SaveLoadModalProps {
  songBook: SongBook;
  // GUS-TODO: return type should hold error
  onLoad: (songBook: SongBook) => boolean;
  onHide: () => void;
  show: boolean;
}

const songBookToJson = (songBook: SongBook): string => {
  return JSON.stringify(songBook);
};

type JsonToSongBookResult =
  | {
      songBook: SongBook;
      error?: undefined;
    }
  | {
      songBook?: undefined;
      error: { message?: string };
    };

const jsonToSongBook = (rawJson: string): JsonToSongBookResult => {
  try {
    return { songBook: JSON.parse(rawJson) };
  } catch (e: any) {
    return { error: e };
  }
};

// A component with an input field and a button to save the songbook
// The component starts with the input field displaying the current songbook serialized as base64
// If the data is modified, the button is enabled
// If the data is not modified, the button is disabled
// If the button is clicked, the songbook is deserialized and passed to the onLoad callback
// An error message is displayed if the songbook is not valid
// The onLoad callback returns true if the songbook was loaded successfully
const SaveLoadModal = (props: SaveLoadModalProps) => {
  const { songBook, onLoad, onHide, show } = props;

  const [errorMessage, setErrorMessage] = useState("");

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void (async () => {
      try {
        const rawJson = await e.target.files?.[0].text();
        if (rawJson) {
          const result = jsonToSongBook(rawJson);
          if (result.error?.message) {
            setErrorMessage(result.error.message);
            return;
          } else if (result.songBook && onLoad(result.songBook)) {
            setErrorMessage("");
            onHide();
            return;
          }
        }
      } catch (e) {
        if (e instanceof Error) {
          setErrorMessage(e.message);
          return;
        }
      }
      setErrorMessage("Erro carregando caderninho");
    })();
  };

  const downloadSongBookJson = () => {
    const json = songBookToJson(songBook);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${new Date().toISOString()}.cadernin.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleHide = () => {
    setErrorMessage("");
    onHide();
  };

  return (
    <Modal show={show} onHide={handleHide}>
      <Modal.Header closeButton>
        <Modal.Title>Save/Load</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <label htmlFor="songBookFileInput" className="form-label">
            Abrir coleção
          </label>
          <input
            type="file"
            className="form-control"
            id="songBookFileInput"
            accept=".json"
            onChange={onFileInput}
          />
        </div>
        <div className="mb-3">
          <button className="btn btn-primary" onClick={downloadSongBookJson}>
            Salvar coleção
          </button>
        </div>
        {errorMessage && (
          <div className="alert alert-danger mt-2" role="alert">
            {errorMessage}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default SaveLoadModal;
