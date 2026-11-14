import type { ScoreViewModel } from "../../types/viewModels";
import type { SongbookItemViewModel } from "../../types/viewModels";
import { isSongbookSection, songbookSection, songbookScore } from "../lib/songbook";
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
  // remove all sections
  const newRows = rows.filter((r) => !isSongbookSection(r));

  // create sections
  const sections = new Map<string, SongbookItemViewModel[]>();
  for (const row of newRows) {
    // keep type system happy
    if (isSongbookSection(row)) {
      continue;
    }
    const style = row.score.tags[0];
    if (sections.has(style)) {
      sections.get(style)?.push(row);
    } else {
      sections.set(style, [row]);
    }
  }

  // regenerate rows
  const sorted: SongbookItemViewModel[] = [];
  for (const [key, value] of sections.entries()) {
    sorted.push(songbookSection(key));
    sorted.push(...value);
  }
  return sorted;
};
