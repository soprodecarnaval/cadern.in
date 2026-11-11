import { useEffect, useState } from "react";
import { getScore, getSongbookById } from "../lib/db";
import { compactScoreLineage, loadScoreLineage } from "../lib/scoreLineage";
import type { ScoreData } from "../../types/docs";

export function ScoreLineage({ scoreId, forkedFrom }: {
  scoreId: string;
  forkedFrom: ScoreData["forkedFrom"];
}) {
  const [titles, setTitles] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setTitles([]);
    setFailed(false);
    void loadScoreLineage(scoreId, getScore, getSongbookById).then((chain) => {
      if (!cancelled) { setTitles(chain); }
    }).catch(() => {
      if (!cancelled) { setFailed(true); }
    });
    return () => { cancelled = true; };
  }, [scoreId, forkedFrom?.scoreId]);

  if (failed) {
    return <div className="small text-muted mb-3">Linhagem indisponível.</div>;
  }
  if (!titles.length) { return null; }
  return <div className="small text-muted mb-3">{compactScoreLineage(titles).join(" → ")}</div>;
}
