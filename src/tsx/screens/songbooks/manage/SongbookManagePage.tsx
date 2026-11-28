import { useParams } from "react-router-dom";
import { useAuth } from "../../../../auth";
import * as db from "../../../../lib/db";
import { generateSongbookPdfs } from "../../../../lib/generateSongbookPdfs";
import { loadPinnedScores } from "../../../../lib/songbookScores";
import { useMemberRole } from "../../../../lib/useMemberRole";
import { ScoreCard } from "../../../components/scores/card/ScoreCard";
import { SongbookPrintSettingsDialog } from "../../../components/songbooks/generation/SongbookPrintSettingsDialog";
import { SongbookManagePageView } from "./SongbookManagePageView";
import { SongbookReader } from "../../../components/songbooks/reader/SongbookReader";
const services = { ...db, loadPinnedScores, generateSongbookPdfs };
const components = {
  ScoreCard,
  SongbookPrintSettingsDialog,
  SongbookReader,
};
export function SongbookManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const role = useMemberRole(slug);
  const { currentUser } = useAuth();
  return (
    <SongbookManagePageView
      services={services}
      components={components}
      role={role}
      currentUser={currentUser}
    />
  );
}
