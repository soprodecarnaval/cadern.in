import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { CardPointerSensor } from "../../../../lib/cardPointerSensor";
import type { ScoreViewModel } from "../../../../../types/viewModels";
import type { ScoreCardHighlight } from "../../../components/scores/card/ScoreCardView";
import { AddButton } from "../../../components/scores/AddButton";
import { DragHandle } from "../../../components/songbooks/editor/DragHandle";
import { PaginationBar } from "../../../components/pagination/PaginationBar";
import { queryRanges } from "../../../../lib/highlight";

interface ScoreSearchResultTableProps {
  Card: import("react").ComponentType<import("../../../components/scores/card/ScoreCardView").ScoreCardProps>;
  scores: ScoreViewModel[];
  searchQuery: string;
  handleSelect: (score: ScoreViewModel, checked: boolean) => void;
}

/** Marks where the typed words appear, not the letters the fuzzy search
 *  happened to match. Tags are shown joined by ", ". */
function buildHighlight(query: string, score: ScoreViewModel): ScoreCardHighlight | undefined {
  if (!query.trim()) {
    return undefined;
  }
  return {
    title: queryRanges(score.title, query),
    composer: queryRanges(score.composer, query),
    projectTitle: queryRanges(score.projectTitle, query),
    tags: queryRanges(score.tags.join(", "), query),
  };
}

function AvailableScoreCard({ Card, score, searchQuery, handleSelect }: {
  Card: ScoreSearchResultTableProps["Card"];
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
        highlight={buildHighlight(searchQuery, score)}
        leading={<DragHandle label={`Arraste ${score.title} para o caderninho`} handleRef={handleRef} onPrepareDrag={() => undefined} />}
        trailing={<AddButton label={`Adicionar ${score.title}`} onClick={() => handleSelect(score, true)} />}
      />
    </div>
  );
}

const ScoreSearchResultTable = ({ Card, scores, searchQuery, handleSelect }: ScoreSearchResultTableProps) => {
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
          <AvailableScoreCard Card={Card} key={song.id}
            handleSelect={handleSelect} score={song} searchQuery={searchQuery} />
        ))}
      </div>
      <div className="mt-2">
        <PaginationBar onChange={handlePageChange} currentPage={page} maxNumberPages={maxNumberPages} />
      </div>
    </>
  );
};

export { ScoreSearchResultTable };
