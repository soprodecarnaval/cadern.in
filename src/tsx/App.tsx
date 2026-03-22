import { useState } from "react";
import { Col, Container, Navbar, Row } from "react-bootstrap";
import { AuthModal } from "./AuthModal";
import { ProfileModal } from "./ProfileModal";

import { SearchBar } from "./SearchBar";
import { ScoreSearchResults } from "./ScoreSearchResults";
import { SongBookTable } from "./SongBookTable";
import { PDFGenerator } from "./PdfGenerator";
import { sortByColumn, SortColumn, SortDirection } from "../utils/sort";
import { SongBar } from "./PlayerBar";
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
import { AuthButton } from "./AuthButton";
import { FEATURE_FLAT_AUTH_ENABLED as FEATURE_FLAG_AUTH_ENABLED } from "../featureFlags";

function App() {
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
          {FEATURE_FLAG_AUTH_ENABLED && (
            <div className="ms-auto d-flex align-items-center gap-2">
              <AuthButton onOpenAuthModal={() => setShowAuthModal(true)} />
            </div>
          )}
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
            <ScoreSearchResults
              results={results}
              onSortBy={handleResultsSortBy}
              onAddAll={handleAddAllSongs}
              onSelectSong={handleSelectSong}
              onSetPlayingPart={setPlayingPart}
            />
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
      <ProfileModal
        show={showProfileModal}
        onHide={() => setShowProfileModal(false)}
      />
    </>
  );
}

export default App;
