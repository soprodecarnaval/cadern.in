import type { ComponentProps } from "react";
import * as db from "../lib/db";
import { ScoreMetadataEditorView } from "./ScoreMetadataEditorView";

export function ScoreMetadataEditor(
  props: Omit<ComponentProps<typeof ScoreMetadataEditorView>, "services">,
) {
  return <ScoreMetadataEditorView {...props} services={db} />;
}
