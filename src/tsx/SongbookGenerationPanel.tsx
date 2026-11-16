import type { ComponentProps } from "react";
import { useAuth } from "../auth";
import { createSongbookCoverPreview } from "../createSongBook";
import { generateSongbookPdfs } from "../lib/generateSongbookPdfs";
import { saveSongbookCovers } from "../lib/songbookCovers";
import { SongbookGenerationPanelView } from "./SongbookGenerationPanelView";

export function SongbookGenerationPanel(
  props: Omit<
    ComponentProps<typeof SongbookGenerationPanelView>,
    "currentUser" | "generateSongbookPdfs" | "saveSongbookCovers" | "createCoverPreview"
  >,
) {
  const { currentUser } = useAuth();
  return (
    <SongbookGenerationPanelView
      {...props}
      currentUser={currentUser}
      generateSongbookPdfs={generateSongbookPdfs}
      saveSongbookCovers={saveSongbookCovers}
      createCoverPreview={createSongbookCoverPreview}
    />
  );
}
