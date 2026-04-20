import { useState } from "react";
import { Col, Container, Nav, Navbar, Row } from "react-bootstrap";
import { Link, Route, Routes } from "react-router-dom";
import { AuthModal } from "./AuthModal";
import { ProfileModal } from "./ProfileModal";

import { SearchBar } from "./SearchBar";
import { ScoreSearchResults } from "./ScoreSearchResults";
import { SongBookTable } from "./SongBookTable";
import { PDFGenerator } from "./PdfGenerator";
import { sortByColumn, SortColumn, SortDirection } from "../utils/sort";
import { SongBar } from "./PlayerBar";

import type {
  PlayingPartViewModel,
  ScoreViewModel,
  SongbookViewModel,
  SongbookItemViewModel,
} from "../../types/viewModels";
import { isSongbookSection, songbookScore } from "../lib/songbook";

import "bootstrap/dist/css/bootstrap.css";
import "../css/App.css";
import { AuthButton } from "./AuthButton";
import { FEATURE_FLAG_AUTH_ENABLED } from "../featureFlags";
import { useAuth } from "../auth";
import { UploadPage } from "./UploadPage";
import { MyScoresPage } from "./MyScoresPage";
import { ScorePage } from "./ScorePage";

function HomePage() {
  const [results, setResults] = useState<ScoreViewModel[]>([]);
  const [items, setItems] = useState<SongbookItemViewModel[]>([]);
  const [playingPart, setPlayingPart] = useState<PlayingPartViewModel | null>(
    null,
  );

  const handleSelectSong = (song: ScoreViewModel, checked: boolean) => {
    checked ? handleAddScore(song) : handleRemoveScore(song);
  };

  const clearSelected = () => {
    setItems([]);
  };

  const handleAddScore = (score: ScoreViewModel) => {
    setItems([...items, songbookScore(score)]);
    setResults(results.filter((r) => r.id !== score.id));
  };

  const handleRemoveScore = (score: ScoreViewModel) => {
    setItems(
      items.filter((r) => isSongbookSection(r) || r.score.id !== score.id),
    );
    setResults([score, ...results]);
  };

  const handleResultsSortBy = (
    column: SortColumn,
    direction: SortDirection,
  ) => {
    setResults(sortByColumn(results, column, direction).slice());
  };

  const handleAddAllSongs = () => {
    const merged: SongbookItemViewModel[] = [
      ...items,
      ...results.map(songbookScore),
    ];
    const deduped = merged.filter(
      (row, index) =>
        isSongbookSection(row) ||
        index ===
          merged.findIndex(
            (o) => !isSongbookSection(o) && row.score.id === o.score.id,
          ),
    );
    setItems(deduped);
    setResults([]);
  };

  const songBook: SongbookViewModel = { items };

  return (
    <>
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
            <h3 className="results">Caderninho</h3>
            <SongBookTable
              rows={items}
              setItems={setItems}
              onSetPlayingPart={setPlayingPart}
              handleSelect={handleSelectSong}
              handleClear={clearSelected}
            />
          </Col>
        </Row>
      </Container>
    </>
  );
}

function App() {
  const [showUserModal, setShowUserModal] = useState(false);
  const { currentUser } = useAuth();

  return (
    <>
      <Navbar
        expand="lg"
        className="bg-body-tertiary"
        bg="dark"
        data-bs-theme="dark"
      >
        <Container>
          <Navbar.Brand as={Link} to="/" className="nav-bar-title">
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
            <Nav className="ms-auto d-flex align-items-center gap-2">
              {currentUser && (
                <>
                  <Nav.Link as={Link} to="/upload">
                    Enviar
                  </Nav.Link>
                  <Nav.Link as={Link} to="/my-scores">
                    Minhas partituras
                  </Nav.Link>
                </>
              )}
              <AuthButton onOpenUserModal={() => setShowUserModal(true)} />
            </Nav>
          )}
        </Container>
      </Navbar>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/upload/:scoreId" element={<UploadPage />} />
        <Route path="/my-scores" element={<MyScoresPage />} />
        <Route path="/score/:scoreId" element={<ScorePage />} />
        <Route path="/score/:scoreId/:revisionId" element={<ScorePage />} />
      </Routes>

      {currentUser ? (
        <ProfileModal
          show={showUserModal}
          onHide={() => setShowUserModal(false)}
        />
      ) : (
        <AuthModal show={showUserModal} onHide={() => setShowUserModal(false)} />
      )}
    </>
  );
}

export default App;
