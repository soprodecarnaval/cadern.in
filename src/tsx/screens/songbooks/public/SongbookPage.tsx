import * as db from "../../../../lib/db";
import { generateSongbookPdfs } from "../../../../lib/generateSongbookPdfs";
import { loadPinnedScores } from "../../../../lib/songbookScores";
import { SongbookPageView } from "./SongbookPageView";
import { SongbookReader } from "../../../components/songbooks/reader/SongbookReader";
const services = { ...db, loadPinnedScores, generateSongbookPdfs };
const components = { SongbookReader };
export function SongbookPage() {
  return <SongbookPageView services={services} components={components} />;
}
