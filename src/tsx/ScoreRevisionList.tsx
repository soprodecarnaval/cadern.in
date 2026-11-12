import type { ComponentProps } from "react";
import * as db from "../lib/db";
import { ScoreRevisionListView } from "./ScoreRevisionListView";

// eslint-disable-next-line react-refresh/only-export-components -- Preserve the existing public constant export.
export { UNKNOWN_UPLOADER } from "./ScoreRevisionListView";

export function ScoreRevisionList(
  props: Omit<ComponentProps<typeof ScoreRevisionListView>, "services">,
) {
  return <ScoreRevisionListView {...props} services={db} />;
}
