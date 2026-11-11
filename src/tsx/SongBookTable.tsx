import { forwardRef } from "react";
import { ScoreCard } from "./ScoreCard";
import {
  SongBookTableView,
  type SongBookTableProps,
} from "./SongBookTableView";
import type { SongbookSortableListHandle } from "./SongbookSortableList";
export const SongBookTable = forwardRef<
  SongbookSortableListHandle,
  SongBookTableProps
>(function SongBookTable(props, ref) {
  return <SongBookTableView {...props} ref={ref} Card={ScoreCard} />;
});
