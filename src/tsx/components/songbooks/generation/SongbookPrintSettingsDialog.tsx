import type { ComponentProps } from "react";
import { useAuth } from "../../../../auth";
import { saveSongbookPrintSettings } from "../../../../lib/db";
import { createSongbookCoverPreview } from "../../../../lib/pdfPreview";
import { saveSongbookCovers } from "../../../../lib/songbookCovers";
import { SongbookPrintSettingsDialogView } from "./SongbookPrintSettingsDialogView";

const services = {
  saveSongbookPrintSettings,
  saveSongbookCovers,
  createCoverPreview: createSongbookCoverPreview,
};

export function SongbookPrintSettingsDialog(
  props: Omit<ComponentProps<typeof SongbookPrintSettingsDialogView>, "currentUser" | "services">,
) {
  const { currentUser } = useAuth();
  return <SongbookPrintSettingsDialogView {...props} currentUser={currentUser} services={services} />;
}
