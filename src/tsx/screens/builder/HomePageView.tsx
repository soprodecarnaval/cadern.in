import { Page } from "../../atoms/Page";
import { Button } from "../../atoms/Button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ScoreSearchResultsView } from "./search/ScoreSearchResultsView";
import { SearchBarView } from "./search/SearchBarView";
import { ColumnDivider, type CollapsedSide } from "./ColumnDivider";
import { SongbookToolbar } from "./SongbookToolbar";
import "./MontarColumns.css";
import { SongbookDragProvider } from "../../components/songbooks/editor/SongbookDragProvider";
import type {
  SectionsCollapsed,
  SongbookSortableListHandle,
} from "../../components/songbooks/editor/SongbookSortableList";
import { SongBookTableView } from "../../components/songbooks/editor/SongBookTableView";

import { sortByColumn, SortColumn, SortDirection } from "../../../utils/sort";
import { generateSectionsByStyle } from "../../../utils/songBookRows";
import { useUndoableState } from "../../../lib/useUndoableState";

import type {
  ScoreViewModel,
  SongbookItemViewModel,
} from "../../../../types/viewModels";
import {
  isSongbookSection,
  songbookScore,
} from "../../../lib/songbook";

import "bootstrap/dist/css/bootstrap.css";
import "../../../styles/app.css";

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
  collection: import("../../../useCollectionContext").CollectionContextValue;
  storage: typeof import("../../../lib/builderStorage");
  collabEnabled: boolean;
  components: {
    Card: import("react").ComponentType<
      import("../../components/scores/card/ScoreCardView").ScoreCardProps
    >;
    SaveSongbookModal: typeof import("./dialogs/SaveSongbookModal").SaveSongbookModal;
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
  // The Caderninho's rows, with undo/redo through the toolbar.
  const history = useUndoableState<SongbookItemViewModel[]>([]);
  const { value: items, set: setItems, reset: resetItems } = history;
  const [sectionsCollapsed, setSectionsCollapsed] = useState<SectionsCollapsed>("none");
  const { status, allScores } = collection;
  const [restored, setRestored] = useState(false);
  const [showSave, setShowSave] = useState(false);
  // Resultados (left) or Caderninho (right) hidden by the column divider.
  const [collapsed, setCollapsed] = useState<CollapsedSide>(null);
  const songbookRef = useRef<SongbookSortableListHandle>(null);
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: SortDirection;
  } | null>(null);

  // The list survives reloads and logins: restored once the collection is
  // loaded, then stored on every change.
  useEffect(() => {
    if (status === "ready" && !restored) {
      resetItems(storage.restoreBuilderItems(allScores));
      setRestored(true);
    }
  }, [status, restored, allScores, storage, resetItems]);

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

  return (
    <>
      <Page>
        <SongbookDragProvider
          songbookRef={songbookRef}
          onAddAt={handleAddScore}
          onRemove={handleRemoveScore}
        >
          <div
            className={
              collapsed
                ? `montar-columns is-${collapsed}-collapsed`
                : "montar-columns"
            }
          >
            <div className="montar-cell montar-search">
              <SearchBarView
                status={collection.status}
                search={collection.search}
                handleResults={handleSearchResults}
              />
            </div>
            <div className="montar-cell montar-generate">
              <div className="montar-actions">
                <SongbookToolbar
                  canUndo={history.canUndo}
                  canRedo={history.canRedo}
                  onUndo={history.undo}
                  onRedo={history.redo}
                  canMakeSections={items.some((item) => !isSongbookSection(item))}
                  onMakeSections={() => setItems(generateSectionsByStyle(items))}
                  sectionsCollapsed={sectionsCollapsed}
                  onSetAllCollapsed={(collapse) =>
                    songbookRef.current?.setAllSectionsCollapsed(collapse)}
                />
                {collabEnabled && (
                  <Button
                    disabled={items.length === 0}
                    onClick={handleSave}
                  >
                    Salvar caderninho
                  </Button>
                )}
              </div>
            </div>
            <ColumnDivider
              collapsed={collapsed}
              onChange={setCollapsed}
              leftLabel="Resultados"
              rightLabel="Caderninho"
            />
            <div className="montar-cell montar-results">
              <ScoreSearchResultsView
                collection={collection}
                Card={components.Card}
                results={results}
                searchQuery={searchQuery}
                onSortBy={handleResultsSortBy}
                onSelectSong={handleSelectSong}
              />
            </div>
            <div className="montar-cell montar-songbook">
              <h3 className="results">Caderninho</h3>
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
                showSectionsByStyle={false}
                onSectionsCollapsedChange={setSectionsCollapsed}
              />
            </div>
          </div>
        </SongbookDragProvider>
      </Page>
    </>
  );
}
