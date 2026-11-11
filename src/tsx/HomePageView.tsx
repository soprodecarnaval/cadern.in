import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Col, Container, Row } from "react-bootstrap";

import { ScoreSearchResultsView } from "./ScoreSearchResultsView";
import { SearchBarView } from "./SearchBarView";
import { SongbookDragProvider } from "./SongbookDragProvider";
import type { SongbookSortableListHandle } from "./SongbookSortableList";
import { SongBookTableView } from "./SongBookTableView";

import { sortByColumn, SortColumn, SortDirection } from "../utils/sort";

import type {
  ScoreViewModel,
  SongbookItemViewModel,
  SongbookViewModel,
} from "../../types/viewModels";
import {
  isSongbookSection,
  numberSongbookItems,
  songbookScore,
} from "../lib/songbook";

import "bootstrap/dist/css/bootstrap.css";
import "../css/App.css";

export function HomePageView({
  onRequestLogin,
  currentUser,
  collection,
  storage,
  collabEnabled,
  components,
}: {
  onRequestLogin: () => void;
  currentUser: import("firebase/auth").User | null;
  collection: import("../useCollectionContext").CollectionContextValue;
  storage: typeof import("../lib/builderStorage");
  collabEnabled: boolean;
  components: {
    Card: import("react").ComponentType<
      import("./ScoreCardView").ScoreCardProps
    >;
    PDFGenerator: typeof import("./PdfGenerator").PDFGenerator;
    SaveSongbookModal: typeof import("./SaveSongbookModal").SaveSongbookModal;
  };
}) {
  const [searchResults, setSearchResults] = useState<ScoreViewModel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const handleSearchResults = useCallback(
    (scores: ScoreViewModel[], query: string) => {
      setSearchResults(scores);
      setSearchQuery(query);
    },
    [],
  );
  const [items, setItems] = useState<SongbookItemViewModel[]>([]);
  const { status, allScores } = collection;
  const [restored, setRestored] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const songbookRef = useRef<SongbookSortableListHandle>(null);
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: SortDirection;
  } | null>(null);

  // The list survives reloads and logins: restored once the collection is
  // loaded, then stored on every change.
  useEffect(() => {
    if (status === "ready" && !restored) {
      setItems(storage.restoreBuilderItems(allScores));
      setRestored(true);
    }
  }, [status, restored, allScores, storage]);

  useEffect(() => {
    if (restored) {
      storage.storeBuilderItems(items);
    }
  }, [restored, items, storage]);

  // Back from logging in to save: carry on with the save.
  useEffect(() => {
    if (currentUser && storage.takePendingSave()) {
      setShowSave(true);
    }
  }, [currentUser, storage]);

  const handleSave = () => {
    if (currentUser) {
      setShowSave(true);
    } else {
      storage.markPendingSave();
      onRequestLogin();
    }
  };

  const handleSelectSong = (song: ScoreViewModel, checked: boolean) => {
    checked ? handleAddScore(song) : handleRemoveScore(song);
  };

  const results = useMemo(() => {
    const selectedIds = new Set(
      items.flatMap((item) => isSongbookSection(item) ? [] : [item.score.id]),
    );
    const available = searchResults.filter((score) => !selectedIds.has(score.id));
    return sort ? sortByColumn(available, sort.column, sort.direction) : available;
  }, [searchResults, items, sort]);

  const clearSelected = () => setItems([]);

  const handleAddScore = (score: ScoreViewModel, index?: number) => {
    setItems((prev) => {
      const next = [...prev];
      next.splice(index ?? next.length, 0, songbookScore(score));
      return next;
    });
  };

  const handleRemoveScore = (score: ScoreViewModel) => {
    setItems(
      items.filter((r) => isSongbookSection(r) || r.score.id !== score.id),
    );
  };

  const handleResultsSortBy = (
    column: SortColumn,
    direction: SortDirection,
  ) => {
    setSort({ column, direction });
  };

  const songBook: SongbookViewModel = { items: numberSongbookItems(items) };

  return (
    <>
      <Container>
        <Row>
          <Col sm={6}>
            <SearchBarView
              status={collection.status}
              search={collection.search}
              handleResults={handleSearchResults}
            />
          </Col>
          <Col sm={6}>
            <components.PDFGenerator songBook={songBook} />
          </Col>
        </Row>
        <SongbookDragProvider
          songbookRef={songbookRef}
          onAddAt={handleAddScore}
          onRemove={handleRemoveScore}
        >
          <Row className="mt-4">
            <Col sm={6}>
              <ScoreSearchResultsView
                collection={collection}
                Card={components.Card}
                results={results}
                searchQuery={searchQuery}
                onSortBy={handleResultsSortBy}
                onSelectSong={handleSelectSong}
              />
            </Col>
            <Col sm={6}>
              <div className="d-flex justify-content-between align-items-baseline">
                <h3 className="results">Caderninho</h3>
                {collabEnabled && (
                  <Button
                    size="sm"
                    variant="outline-primary"
                    disabled={items.length === 0}
                    onClick={handleSave}
                  >
                    Salvar caderninho
                  </Button>
                )}
              </div>
              {currentUser && showSave && (
                <components.SaveSongbookModal
                  show
                  user={currentUser}
                  items={items}
                  onHide={() => setShowSave(false)}
                />
              )}
              <SongBookTableView
                Card={components.Card}
                ref={songbookRef}
                rows={items}
                setItems={setItems}
                handleSelect={handleSelectSong}
                handleClear={clearSelected}
              />
            </Col>
          </Row>
        </SongbookDragProvider>
      </Container>
    </>
  );
}
