import { useEffect, useState } from "react";
import type { ScoreData } from "../../types/docs";
import { compactScoreLineage, loadScoreLineage } from "../lib/scoreLineage";
export type ScoreLineageServices = Pick<
  typeof import("../lib/db"),
  "getScore" | "getSongbookById"
>;

export function ScoreLineageView({
  services,

  scoreId,
  forkedFrom,
}: {
  services: ScoreLineageServices;

  scoreId: string;
  forkedFrom: ScoreData["forkedFrom"];
}) {
  const [titles, setTitles] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setTitles([]);
    setFailed(false);
    void loadScoreLineage(scoreId, services.getScore, services.getSongbookById)
      .then((lineage) => {
        if (!cancelled) {
          setTitles(lineage);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [scoreId, forkedFrom?.scoreId, services]);
  if (failed) {
    return <div className="small text-muted mb-3">Linhagem indisponível.</div>;
  }
  if (!titles.length) {
    return null;
  }
  return <div className="small text-muted mb-3">{compactScoreLineage(titles).join(" → ")}</div>;
}
