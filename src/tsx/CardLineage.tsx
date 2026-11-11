import { ScoreLineage } from "./ScoreLineage";

export function CardLineage({ scoreId }: { scoreId: string }) {
  return <ScoreLineage scoreId={scoreId} forkedFrom={undefined} />;
}
