import { Table } from "react-bootstrap";

import type { LegacyScore, PlayingPart } from "../../types";

import { ArrangementItem } from "./ScoreSearchResultRow";
import { PaginationBar } from "./PaginationBar";
import { useState } from "react";

interface ScoreSearchResultTableProps {
  songs: LegacyScore[];
  handleSelect: (score: LegacyScore, checked: boolean) => void;
  onSetPlayingPart: (info: PlayingPart) => void;
}

const ScoreSearchResultTable = ({
  songs,
  handleSelect,
  onSetPlayingPart: handlePlayingSong,
}: ScoreSearchResultTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const maxNumberPages = Math.round(songs.length / 10) + 1;

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <>
      <Table striped borderless hover>
        <thead>
          <tr>
            <th></th>
            <th>Título</th>
            <th>Arranjo</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {songs.slice((currentPage - 1) * 10, currentPage * 10).map((song) => (
            <ArrangementItem
              handleSelect={handleSelect}
              score={song}
              key={song.id}
              handlePlayingSong={handlePlayingSong}
            />
          ))}
        </tbody>
      </Table>
      <PaginationBar
        onChange={handlePageChange}
        currentPage={currentPage}
        maxNumberPages={maxNumberPages}
      />
    </>
  );
};

export { ScoreSearchResultTable };
