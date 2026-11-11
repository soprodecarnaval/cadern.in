import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import type { FuseResultMatch } from "fuse.js";
import { CardPointerSensor } from "../lib/cardPointerSensor";
import type { ScoreViewModel } from "../../types/viewModels";
import type { ScoreCardHighlight } from "./ScoreCardView";
import { AddButton } from "./AddButton";
import { DragHandle } from "./DragHandle";
import { PaginationBar } from "./PaginationBar";

interface ScoreSearchResultTableProps {
  Card: import("react").ComponentType<import("./ScoreCardView").ScoreCardProps>;
  getMatches: import("../useCollectionContext").CollectionContextValue["getMatches"];
  scores: ScoreViewModel[];
  searchQuery: string;
  handleSelect: (score: ScoreViewModel, checked: boolean) => void;
}

/** Fuse matches tags against one array element at a time; map those indices to the display string. */
function buildHighlight(matches: readonly FuseResultMatch[] | undefined, score: ScoreViewModel): ScoreCardHighlight | undefined {
  if (!matches?.length) {
    return undefined;
  }
  const highlight: ScoreCardHighlight = {};
  for (const match of matches) {
    if (!match.indices?.length) {
      continue;
    }
    if (match.key === "title") {
      highlight.title = match.indices;
    } else if (match.key === "composer") {
      highlight.composer = match.indices;
    } else if (match.key === "projectTitle") {
      highlight.projectTitle = match.indices;
    } else if (match.key === "tags" && match.value !== undefined) {
      const tagIndex = score.tags.indexOf(match.value);
      if (tagIndex >= 0) {
        const offset = score.tags.slice(0, tagIndex).reduce((sum, tag) => sum + tag.length + 2, 0);
        highlight.tags = [...(highlight.tags ?? []), ...match.indices.map(([start, end]): [number, number] => [start + offset, end + offset])];
      }
    }
  }
  return highlight;
}

function AvailableScoreCard({ Card, getMatches, score, searchQuery, handleSelect }: {
  Card: ScoreSearchResultTableProps["Card"];
  getMatches: ScoreSearchResultTableProps["getMatches"];
  score: ScoreViewModel;
  searchQuery: string;
  handleSelect: ScoreSearchResultTableProps["handleSelect"];
}) {
  const [mode, setMode] = useState<"compact" | "expanded">("compact");
  const { ref, handleRef } = useDraggable({
    id: `available:${score.id}`,
    data: { group: "available", score },
    sensors: [CardPointerSensor],
  });
  return (
    <div ref={ref}>
      <Card
        score={score}
        mode={mode}
        onToggleMode={() => setMode(mode === "compact" ? "expanded" : "compact")}
        highlight={buildHighlight(getMatches(searchQuery, score.id), score)}
        leading={<DragHandle label={`Arraste ${score.title} para o caderninho`} handleRef={handleRef} onPrepareDrag={() => undefined} />}
        trailing={<AddButton label={`Adicionar ${score.title}`} onClick={() => handleSelect(score, true)} />}
      />
    </div>
  );
}

const ScoreSearchResultTable = ({ Card, getMatches, scores, searchQuery, handleSelect }: ScoreSearchResultTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const maxNumberPages = Math.max(1, Math.ceil(scores.length / 10));
  const page = Math.min(currentPage, maxNumberPages);
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(Number.isFinite(pageNumber) ? Math.max(1, Math.min(pageNumber, maxNumberPages)) : 1);
  };
  const { ref: dropRef } = useDroppable({
    id: "available-dropzone",
    data: { group: "available" },
    accept: (source) => (source.data as { group?: string; itemType?: string }).group === "songbook" &&
      (source.data as { itemType?: string }).itemType === "score",
  });
  return (
    <>
      <div ref={dropRef} className="score-card-list">
        {scores.slice((page - 1) * 10, page * 10).map((song) => (
          <AvailableScoreCard Card={Card} getMatches={getMatches} key={song.id}
            handleSelect={handleSelect} score={song} searchQuery={searchQuery} />
        ))}
      </div>
      <PaginationBar onChange={handlePageChange} currentPage={page} maxNumberPages={maxNumberPages} />
    </>
  );
};

export { ScoreSearchResultTable };
