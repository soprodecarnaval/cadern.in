import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { CardPointerSensor } from "../lib/cardPointerSensor";
import type { FuseResultMatch } from "fuse.js";

import type { ScoreViewModel } from "../../types/viewModels";
import { useCollectionContext } from "../useCollectionContext";

import { ScoreCard, type ScoreCardHighlight } from "./ScoreCard";
import { AddButton } from "./AddButton";
import { DragHandle } from "./DragHandle";
import { PaginationBar } from "./PaginationBar";

interface ScoreSearchResultTableProps {
  scores: ScoreViewModel[];
  searchQuery: string;
  handleSelect: (score: ScoreViewModel, checked: boolean) => void;
}

/** Fuse matches tags against one array element at a time; map that element's
 * indices back to its offset within the `, `-joined display string. */
function buildHighlight(
  matches: readonly FuseResultMatch[] | undefined,
  score: ScoreViewModel,
): ScoreCardHighlight | undefined {
  if (!matches || matches.length === 0) {
    return undefined;
  }
  const highlight: ScoreCardHighlight = {};
  for (const match of matches) {
    if (!match.indices || match.indices.length === 0) {
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
        const offset = score.tags
          .slice(0, tagIndex)
          .reduce((sum, tag) => sum + tag.length + 2, 0);
        highlight.tags = [
          ...(highlight.tags ?? []),
          ...match.indices.map(([start, end]): [number, number] => [start + offset, end + offset]),
        ];
      }
    }
  }
  return highlight;
}

function AvailableScoreCard({
  score,
  searchQuery,
  handleSelect,
}: {
  score: ScoreViewModel;
  searchQuery: string;
  handleSelect: (score: ScoreViewModel, checked: boolean) => void;
}) {
  const [mode, setMode] = useState<"compact" | "expanded">("compact");
  const { getMatches } = useCollectionContext();
  // Pointer-only: no stable order to preserve, so no keyboard drag affordance
  // here — keyboard users add via the "+" button instead.
  const { ref, handleRef } = useDraggable({
    id: `available:${score.id}`,
    data: { group: "available", score },
    sensors: [CardPointerSensor],
  });
  return (
    <div ref={ref}>
      <ScoreCard
        score={score}
        mode={mode}
        onToggleMode={() => setMode(mode === "compact" ? "expanded" : "compact")}
        highlight={buildHighlight(getMatches(searchQuery, score.id), score)}
        leading={<DragHandle label={`Arraste ${score.title} para o caderninho`} handleRef={handleRef} onPrepareDrag={() => undefined} />}
        trailing={
          <AddButton
            label={`Adicionar ${score.title}`}
            onClick={() => handleSelect(score, true)}
          />
        }
      />
    </div>
  );
}

const ScoreSearchResultTable = ({
  scores,
  searchQuery,
  handleSelect,
}: ScoreSearchResultTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const maxNumberPages = Math.round(scores.length / 10) + 1;

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Drop zone for songbook cards dragged back out: removes them, regardless
  // of where in this list they're dropped.
  const { ref: dropRef } = useDroppable({
    id: "available-dropzone",
    data: { group: "available" },
    accept: (source) =>
      (source.data as { group?: string; itemType?: string }).group === "songbook" &&
      (source.data as { itemType?: string }).itemType === "score",
  });

  return (
    <>
      <div ref={dropRef} className="score-card-list">
        {scores.slice((currentPage - 1) * 10, currentPage * 10).map((song) => (
          <AvailableScoreCard
            handleSelect={handleSelect}
            score={song}
            searchQuery={searchQuery}
            key={song.id}
          />
        ))}
      </div>
      <PaginationBar
        onChange={handlePageChange}
        currentPage={currentPage}
        maxNumberPages={maxNumberPages}
      />
    </>
  );
};

export { ScoreSearchResultTable };
