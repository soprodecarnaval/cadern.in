import { Page } from "../../atoms/Page";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ScoreSearchResultsView } from "./search/ScoreSearchResultsView";
import { SearchBarView } from "./search/SearchBarView";
import { ColumnDivider, type CollapsedSide } from "../../components/songbooks/editor/ColumnDivider";
import { SongbookEditorList, SongbookEditorToolbar } from "../../components/songbooks/editor/SongbookEditor";
import { useSongbookEditor } from "../../components/songbooks/editor/useSongbookEditor";
import {
  filterOptions,
  filterScores,
  NO_FILTERS,
  type ResultsFilters,
} from "./search/resultsFilter";
import "./MontarColumns.css";
import { SongbookDragProvider } from "../../components/songbooks/editor/SongbookDragProvider";

import { sortByColumn, SortColumn, SortDirection } from "../../../utils/sort";

import type { ScoreViewModel } from "../../../../types/viewModels";
import { isSongbookSection } from "../../../lib/songbook";

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
  // The Caderninho, shared with a songbook's edit screen.
  const editor = useSongbookEditor([]);
  const { items, history: { reset: resetItems } } = editor;
  const { status, allScores } = collection;
  const [restored, setRestored] = useState(false);
  const [showSave, setShowSave] = useState(false);
  // Resultados (left) or Caderninho (right) hidden by the column divider.
  const [collapsed, setCollapsed] = useState<CollapsedSide>(null);
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


  // Resultados' filters, chosen from the styles and arrangements among the
  // songs found (and not yet in the Caderninho).
  const [filters, setFilters] = useState<ResultsFilters>(NO_FILTERS);
  const available = useMemo(() => {
    const selectedIds = new Set(
      items.flatMap((item) => isSongbookSection(item) ? [] : [item.score.id]),
    );
    return searchResults.filter((score) => !selectedIds.has(score.id));
  }, [searchResults, items]);
  const availableFilters = useMemo(() => filterOptions(available), [available]);
  const results = useMemo(() => {
    const filtered = filterScores(available, filters);
    return sort ? sortByColumn(filtered, sort.column, sort.direction) : filtered;
  }, [available, filters, sort]);


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
          songbookRef={editor.listRef}
          onAddAt={editor.add}
          onRemove={editor.remove}
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
                <SongbookEditorToolbar
                  editor={editor}
                  onSave={collabEnabled ? handleSave : undefined}
                />
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
                onSelectSong={editor.select}
                filter={{ options: availableFilters, value: filters, onChange: setFilters }}
              />
            </div>
            <div className="montar-cell montar-songbook">
              <SongbookEditorList editor={editor} Card={components.Card}>
                {currentUser && showSave && (
                  <components.SaveSongbookModal
                    show
                    user={currentUser}
                    items={items}
                    onHide={() => setShowSave(false)}
                  />
                )}
              </SongbookEditorList>
            </div>
          </div>
        </SongbookDragProvider>
      </Page>
    </>
  );
}
