import { useParams } from "react-router-dom";
import { useAuth } from "../../../../auth";
import * as db from "../../../../lib/db";
import { useMemberRole } from "../../../../lib/useMemberRole";
import { generateSongbookPdfs } from "../../../../lib/generateSongbookPdfs";
import { loadPinnedScores } from "../../../../lib/songbookScores";
import { SongbookPageView } from "./SongbookPageView";
import { SongbookReader } from "../../../components/songbooks/reader/SongbookReader";
const services = { ...db, loadPinnedScores, generateSongbookPdfs };
const components = { SongbookReader };
export function SongbookPage() {
  const { slug } = useParams<{ slug: string }>();
  const { currentUser } = useAuth();
  const role = useMemberRole(slug);
  return (
    <SongbookPageView
      services={services}
      components={components}
      currentUser={currentUser}
      role={role}
    />
  );
}
