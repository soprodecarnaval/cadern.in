import { useState } from "react";
import { ScoreCardView, type ScoreCardProps } from "./ScoreCardView";
import { ScoreDetailModal } from "../detail/ScoreDetailModal";
export type { ScoreCardHighlight } from "./ScoreCardView";

export function ScoreCard(props: ScoreCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <>
      <ScoreCardView
        {...props}
        onShowDetail={() => setShowDetail(true)}
      />
      <ScoreDetailModal show={showDetail} scoreId={props.score.id} onHide={() => setShowDetail(false)} />
    </>
  );
}
