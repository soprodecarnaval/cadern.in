import type { ScoreViewModel } from "../../types/viewModels";
import type { SongbookItemViewModel } from "../../types/viewModels";
import { isSongbookSection, songbookSection, songbookScore } from "../lib/songbook";
import { scoreStyleKey, scoreStyleLabel } from "../lib/scoreStyle";
import {
  SortColumn,
  sortByColumn,
  SortDirection,
} from "./sort";

export const deleteRow = (rows: SongbookItemViewModel[], idx: number) => {
  const newRows = [...rows];
  newRows.splice(idx, 1);
  return newRows;
};

export const sortSongsWithinSections = (
  rows: SongbookItemViewModel[],
  column: SortColumn,
  direction: SortDirection,
) => {
  // sort slices of songs delimited by sections
  const sorted: SongbookItemViewModel[] = [];
  let slice: ScoreViewModel[] = [];
  for (const row of rows) {
    if (isSongbookSection(row)) {
      if (slice.length > 0) {
        const sortedSongRows = sortByColumn(slice, column, direction).map(
          songbookScore,
        );
        sorted.push(...sortedSongRows);
      }
      sorted.push(row);
      slice = [];
    } else {
      slice.push(row.score);
    }
  }
  // sort last slice
  if (slice.length > 0) {
    const sortedSongRows = sortByColumn(slice, column, direction).map(
      songbookScore,
    );
    sorted.push(...sortedSongRows);
  }

  return sorted;
};

export const generateSectionsByStyle = (rows: SongbookItemViewModel[]) => {
  const sections = new Map<string, { title: string; rows: SongbookItemViewModel[] }>();
  for (const row of rows) {
    if (isSongbookSection(row)) {
      continue;
    }
    const key = scoreStyleKey(row.score);
    const section = sections.get(key);
    if (section) {
      section.rows.push(row);
    } else {
      sections.set(key, { title: scoreStyleLabel(row.score), rows: [row] });
    }
  }

  return [...sections.values()].flatMap(({ title, rows }) => [
    songbookSection(title), ...rows,
  ]);
};
