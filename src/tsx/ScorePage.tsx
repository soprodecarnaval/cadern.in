import { useAuth } from "../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../featureFlags";
import * as db from "../lib/db";
import { loadScore } from "../lib/loadScore";
import { ReviewCommentsPanel } from "./ReviewCommentsPanel";
import { ScoreDisplay } from "./ScoreDisplay";
import { ScoreLineage } from "./ScoreLineage";
import { ScoreMetadataEditor } from "./ScoreMetadataEditor";
import { ScorePageView } from "./ScorePageView";
import { ScoreRevisionList } from "./ScoreRevisionList";
const services = { ...db, loadScore };
const components = {
  ScoreDisplay,
  ScoreLineage,
  ScoreRevisionList,
  ReviewCommentsPanel,
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
