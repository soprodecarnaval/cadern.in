import type { ComponentProps } from "react";
import { useAuth } from "../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../featureFlags";
import * as db from "../lib/db";
import { loadScore } from "../lib/loadScore";
import { ScoreDetailModalView } from "./ScoreDetailModalView";
import { ScoreDisplay } from "./ScoreDisplay";
import { ScoreLineage } from "./ScoreLineage";
import { ScoreRevisionList } from "./ScoreRevisionList";
const services = { ...db, loadScore };
const components = { ScoreDisplay, ScoreLineage, ScoreRevisionList };

export function ScoreDetailModal(
  props: Omit<
    ComponentProps<typeof ScoreDetailModalView>,
    "services" | "currentUser" | "collabEnabled" | "components"
  >,
) {
  const { currentUser } = useAuth();
  return (
    <ScoreDetailModalView
      {...props}
      services={services}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      components={components}
    />
  );
}
