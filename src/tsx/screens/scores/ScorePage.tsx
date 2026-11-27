import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import * as db from "../../../lib/db";
import { loadScore } from "../../../lib/loadScore";
import { ReviewCommentsPanel } from "../../components/review/ReviewCommentsPanel";
import { ScoreReviewRequests } from "../../components/review/ScoreReviewRequests";
import { ScoreDisplay } from "../../components/scores/detail/ScoreDisplay";
import { ScoreLineage } from "../../components/scores/detail/ScoreLineage";
import { ScoreMetadataEditor } from "./ScoreMetadataEditor";
import { ScorePageView } from "./ScorePageView";
import { ScoreRevisionList } from "../../components/scores/detail/ScoreRevisionList";
const services = { ...db, loadScore };
const components = {
  ScoreDisplay,
  ScoreLineage,
  ScoreRevisionList,
  ReviewCommentsPanel,
  ScoreReviewRequests,
  ScoreMetadataEditor,
};
export function ScorePage() {
  const { currentUser } = useAuth();
  return (
    <ScorePageView
      services={services}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      components={components}
    />
  );
}
