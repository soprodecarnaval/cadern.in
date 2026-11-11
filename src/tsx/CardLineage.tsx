import { useEffect, useState } from "react";
import { getScore } from "../lib/db";
import { ScoreLineage } from "./ScoreLineage";
import type { ScoreData } from "../../types/docs";

/** Fetches a score's forkedFrom and renders its lineage (parent + top forks). */
export function CardLineage({ scoreId }: { scoreId: string }) {
  const [forkedFrom, setForkedFrom] = useState<ScoreData["forkedFrom"]>();

  useEffect(() => {
    let cancelled = false;
    setForkedFrom(undefined);
    void getScore(scoreId).then((doc) => {
      if (!cancelled) {
        setForkedFrom(doc?.forkedFrom);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scoreId]);

  return <ScoreLineage scoreId={scoreId} forkedFrom={forkedFrom} />;
}
