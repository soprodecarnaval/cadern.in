import { useState } from "react";
import { ScoreCardView, type ScoreCardProps } from "./ScoreCardView";
import { CardLineage } from "./CardLineage";
import { ScoreDetailModal } from "./ScoreDetailModal";
export type { ScoreCardHighlight } from "./ScoreCardView";

export function ScoreCard(props: ScoreCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <>
      <ScoreCardView
        {...props}
        lineage={props.mode === "expanded" ? <CardLineage scoreId={props.score.id} /> : null}
        onShowDetail={() => setShowDetail(true)}
      />
      <ScoreDetailModal show={showDetail} scoreId={props.score.id} onHide={() => setShowDetail(false)} />
    </>
  );
}
