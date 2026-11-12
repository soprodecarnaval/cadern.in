import { useParams } from "react-router-dom";
import { useAuth } from "../auth";
import * as db from "../lib/db";
import { generateSongbookPdfs } from "../lib/generateSongbookPdfs";
import { loadPinnedScores } from "../lib/songbookScores";
import { useMemberRole } from "../lib/useMemberRole";
import { ScoreCard } from "./ScoreCard";
import { SongbookGenerationPanel } from "./SongbookGenerationPanel";
import { SongbookPageView } from "./SongbookPageView";
import { SongbookReader } from "./SongbookReader";
const services = { ...db, loadPinnedScores, generateSongbookPdfs };
const components = {
  ScoreCard,
  SongbookGenerationPanel,
  SongbookReader,
};
export function SongbookPage() {
  const { slug } = useParams<{ slug: string }>();
  const role = useMemberRole(slug);
  const { currentUser } = useAuth();
  return (
    <SongbookPageView
      services={services}
      components={components}
      role={role}
      currentUser={currentUser}
    />
  );
}
