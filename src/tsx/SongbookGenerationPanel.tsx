import type { ComponentProps } from "react";
import { useAuth } from "../auth";
import { generateSongbookPdfs } from "../lib/generateSongbookPdfs";
import { saveSongbookCovers } from "../lib/songbookCovers";
import { SongbookGenerationPanelView } from "./SongbookGenerationPanelView";

export function SongbookGenerationPanel(
  props: Omit<
    ComponentProps<typeof SongbookGenerationPanelView>,
    "currentUser" | "generateSongbookPdfs" | "saveSongbookCovers"
  >,
) {
  const { currentUser } = useAuth();
  return (
    <SongbookGenerationPanelView
      {...props}
      currentUser={currentUser}
      generateSongbookPdfs={generateSongbookPdfs}
      saveSongbookCovers={saveSongbookCovers}
    />
  );
}
