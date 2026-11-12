import type { ComponentProps } from "react";
import * as db from "../lib/db";
import { ScoreLineageView } from "./ScoreLineageView";

export function ScoreLineage(
  props: Omit<ComponentProps<typeof ScoreLineageView>, "services">,
) {
  return <ScoreLineageView {...props} services={db} />;
}
