import { useState } from "react";
import { Button, Col, Container, Navbar, Row } from "react-bootstrap";
import { useAuth } from "../auth";
import { AuthModal } from "./AuthModal";
import { ProfileModal } from "./ProfileModal";

import { Sort } from "./Sort";
import { SearchBar } from "./SearchBar";
import { ScoreSearchResultTable } from "./ScoreSearchResultTable";
import { SongBookTable } from "./SongBookTable";
import { PDFGenerator } from "./PdfGenerator";
import { sortByColumn, SortColumn, SortDirection } from "../utils/sort";
import { SongBar } from "./PlayerBar";
import { AddAllSongsButton } from "./AddAllScoresButton";
import { BsFillSave2Fill } from "react-icons/bs";

import {
  isSongBookSection,
  Score,
  SongBook,
  songBookScore,
  PlayingPart,
  SongBookItem,
} from "../../types";

import "bootstrap/dist/css/bootstrap.css";
import "../css/App.css";
import SaveLoadModal from "./SaveLoadModal";

function App() {
  const { currentUser, logout } = useAuth();
  const [results, setResults] = useState<Score[]>([]);
  const [items, setItems] = useState<SongBookItem[]>([]);
  const [showSaveLoadModal, setShowSaveLoadModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [playingPart, setPlayingPart] = useState<PlayingPart | null>(null);
  const handleSelectSong = (song: Score, checked: boolean) => {
    checked ? handleAddScore(song) : handleRemoveScore(song);
  };

  const clearSelected = () => {
    setItems([]);
  };

  const handleAddScore = (score: Score) => {
    setItems([...items, songBookScore(score)]);
    const updatedRes = results.filter((r) => r.id !== score.id);

    setResults(updatedRes);
  };

  const handleRemoveScore = (score: Score) => {
    const updatedRes = items.filter(
      (r) => isSongBookSection(r) || r.score.id !== score.id,
    );

    setResults([score, ...results]);
    setItems(updatedRes);
  };

  const handleResultsSortBy = (
    column: SortColumn,
    direction: SortDirection,
  ) => {
    const sorted = sortByColumn(results, column, direction);
    setResults(sorted.slice());
  };

  const handleAddAllSongs = () => {
    const newSongBookItems: SongBookItem[] = [
      ...items,
      ...results.map(songBookScore),
    ];
    const newUniqueSelectedResults = newSongBookItems.filter((row, index) => {
      return (
        // include sections
        isSongBookSection(row) ||
        // include first occurrence of song
        index ===
          newSongBookItems.findIndex(
            (o) => !isSongBookSection(o) && row.score.id === o.score.id,
          )
      );
    });
    setItems(newUniqueSelectedResults);
    setResults([]);
  };

  // TODO: load all songbook fields (title, etc) instead of just rows
  const loadSongBook = (songBook: SongBook) => {
    // TODO: how to handle errors?
    // TODO: reset results from search bar?
    setItems(songBook.items);
    return true;
  };

  const songBook: SongBook = { items };

  return (
    <>
      <Navbar
        expand="lg"
        className="bg-body-tertiary"
        bg="dark"
        data-bs-theme="dark"
      >
        <Container>
          <Navbar.Brand className="nav-bar-title" href="#">
            cadern.in
          </Navbar.Brand>
          <div className="banner-container">
            <a href="/2026" className="banner banner-yellow">
              Carnaval BH 2026
            </a>
            <a href="/plugin" className="banner banner-blue">
              Plugin de Musescore
            </a>
          </div>
          <div className="ms-auto d-flex align-items-center gap-2">
            {currentUser ? (
              <>
                <button
                  type="button"
                  className="btn btn-link p-0 d-flex align-items-center gap-2 text-light text-decoration-none"
                  onClick={() => setShowProfileModal(true)}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#888",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        color: "#fff",
                      }}
                    >
                      {(currentUser.displayName?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <span>{currentUser.displayName}</span>
                </button>
                <Button variant="outline-light" size="sm" onClick={() => void logout()}>Sair</Button>
              </>
            ) : (
              <Button variant="outline-light" size="sm" onClick={() => setShowAuthModal(true)}>Entrar</Button>
            )}
          </div>
        </Container>
      </Navbar>
      <Container>
        <Row>
          <Col sm={6}>
            <SearchBar handleResults={setResults} />
          </Col>
          <Col sm={6}>
            <PDFGenerator songBook={songBook} />
          </Col>
        </Row>
        <SongBar info={playingPart} />
        <Row className="mt-4">
          <Col sm={6}>
            {results.length > 0 && (
              <>
                <h3 className="results">Resultados</h3>
                <Row>
                  <Col sm="6">
                    <Sort onSortBy={handleResultsSortBy} />
                  </Col>
                  <Col sm="2" />
                  <Col sm="4">
                    <AddAllSongsButton
                      count={results.length}
                      onAddAllScores={handleAddAllSongs}
                    />
                  </Col>
                </Row>
                <ScoreSearchResultTable
                  songs={results}
                  onSetPlayingPart={setPlayingPart}
                  handleSelect={handleSelectSong}
                />
              </>
            )}
          </Col>
          <Col sm={6}>
            <>
              <h3 className="results">
                Caderninho
                <BsFillSave2Fill onClick={() => setShowSaveLoadModal(true)} />
              </h3>
              <SongBookTable
                rows={items}
                setItems={setItems}
                onSetPlayingPart={setPlayingPart}
                handleSelect={handleSelectSong}
                handleClear={clearSelected}
              />
            </>
          </Col>
        </Row>
      </Container>
      <SaveLoadModal
        songBook={songBook}
        onLoad={loadSongBook}
        onHide={() => setShowSaveLoadModal(false)}
        show={showSaveLoadModal}
      />
      <AuthModal show={showAuthModal} onHide={() => setShowAuthModal(false)} />
      <ProfileModal show={showProfileModal} onHide={() => setShowProfileModal(false)} />
    </>
  );
}

export default App;
