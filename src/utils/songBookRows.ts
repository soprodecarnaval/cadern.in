import type { ScoreViewModel } from "../../types/viewModels";
import type { SongBookItem } from "../../types/songbook";
import { isSongBookSection, songBookSection, songBookScore } from "../../types/songbook";
import {
  SortColumn,
  sortByColumn,
  SortDirection,
  carnivalSectionOrder,
} from "./sort";

// moves a row up or down, swapping it with the row in the new position
export const moveRow = (rows: SongBookItem[], idx: number, steps: number) => {
  if (idx + steps < 0 || idx + steps >= rows.length) {
    return rows;
  }

  // move the rows
  const newRows = [...rows];
  const temp = newRows[idx];
  newRows[idx] = newRows[idx + steps];
  newRows[idx + steps] = temp;
  return newRows;
};

export const deleteRow = (rows: SongBookItem[], idx: number) => {
  const newRows = [...rows];
  newRows.splice(idx, 1);
  return newRows;
};

export const sortSongsWithinSections = (
  rows: SongBookItem[],
  column: SortColumn,
  direction: SortDirection,
) => {
  // sort slices of songs delimited by sections
  const sorted: SongBookItem[] = [];
  let slice: ScoreViewModel[] = [];
  for (const row of rows) {
    if (isSongBookSection(row)) {
      if (slice.length > 0) {
        const sortedSongRows = sortByColumn(slice, column, direction).map(
          songBookScore,
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
      songBookScore,
    );
    sorted.push(...sortedSongRows);
  }

  return sorted;
};

export const generateSectionsByStyle = (rows: SongBookItem[]) => {
  // remove all sections
  const newRows = rows.filter((r) => !isSongBookSection(r));

  // create sections
  const sections = new Map<string, SongBookItem[]>();
  for (const row of newRows) {
    // keep type system happy
    if (isSongBookSection(row)) {
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
  const sorted: SongBookItem[] = [];
  for (const [key, value] of sections.entries()) {
    sorted.push(songBookSection(key));
    sorted.push(...value);
  }
  return sorted;
};

// secion names have changed over time, so we need to map them to the current ones
// some of them have been capitalized or had a plural -s added to the end
const normalizeSectionName = (name: string) => {
  return name.toLocaleLowerCase().replace(/s$/, "");
};

export const generateCarnivalSections = (rows: SongBookItem[]) => {
  rows = generateSectionsByStyle(rows);

  // pick only carnival sections, keeping their order
  // ignore sections not in the order
  const allSongs: Map<string, ScoreViewModel> = new Map();
  for (const row of rows) {
    if (row.type == "score") {
      allSongs.set(row.score.title, row.score);
    }
  }

  const newRows: SongBookItem[] = [];
  for (const section of carnivalSectionOrder) {
    // find section index
    const idx = rows.findIndex(
      (r) =>
        isSongBookSection(r) &&
        normalizeSectionName(r.title) === normalizeSectionName(section),
    );
    if (idx === -1) {
      continue;
    }
    // push style
    newRows.push(rows[idx]);

    // add all songs in section
    const slice: ScoreViewModel[] = [];
    for (let i = idx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (isSongBookSection(row)) {
        break;
      }
      slice.push(row.score);
      allSongs.delete(row.score.title);
    }
    // push sorted slice
    const sorted = sortByColumn(slice, "title", "asc").map(songBookScore);
    newRows.push(...sorted);
  }
  for (const rest of allSongs.values()) {
    console.log(rest.title, rest.tags);
  }
  return newRows;
};
