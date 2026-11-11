import type { ComponentProps } from "react";
import * as db from "../lib/db";
import { ReviewCommentsPanelView } from "./ReviewCommentsPanelView";

export function ReviewCommentsPanel(
  props: Omit<ComponentProps<typeof ReviewCommentsPanelView>, "services">,
) {
  return <ReviewCommentsPanelView {...props} services={db} />;
}
