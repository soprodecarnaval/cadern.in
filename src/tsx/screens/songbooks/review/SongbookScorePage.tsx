import { useParams } from "react-router-dom";
import { useAuth } from "../../../../auth";
import * as db from "../../../../lib/db";
import { useMemberRole } from "../../../../lib/useMemberRole";
import { ReviewCommentsPanelView } from "../../../components/review/ReviewCommentsPanelView";
import { ScoreDisplay } from "../../../components/scores/detail/ScoreDisplay";
import { SongbookScorePageView } from "./SongbookScorePageView";
const services = { ...db };
const components = {
  ScoreDisplay,
  ReviewCommentsPanel: ReviewCommentsPanelView,
};
export function SongbookScorePage() {
  const { slug } = useParams<{ slug: string }>();
  const role = useMemberRole(slug);
  const { currentUser } = useAuth();
  return (
    <SongbookScorePageView
      services={services}
      components={components}
      role={role}
      currentUser={currentUser}
    />
  );
}
