import { useEffect, useState } from "react";
import { Badge } from "react-bootstrap";
import { getScore, getScoreRevision } from "../lib/db";
import { resolveScoreMetadata } from "../lib/scoreMetadata";
import { ScoreDetailModal } from "./ScoreDetailModal";
import type { ScoreData } from "../../types/docs";

interface Source {
  title: string;
  revisionNumber: number | null;
}

/**
 * Informational only — shown when the score is itself a fork of another
 * score. No "derivação disponível" swap prompt; that stays on
 * SongbookContents, which is about a different concern (a newer fork exists
 * elsewhere in the project, not "this score has a parent").
 */
export function LineageBadge({ scoreId }: { scoreId: string }) {
  const [forkedFrom, setForkedFrom] = useState<ScoreData["forkedFrom"]>();
  const [source, setSource] = useState<Source | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    if (!forkedFrom) {
      return;
    }
    void (async () => {
      const [score, revision] = await Promise.all([
        getScore(forkedFrom.scoreId),
        getScoreRevision(forkedFrom.scoreId, forkedFrom.revisionId),
      ]);
      if (!cancelled && score) {
        setSource({
          title: resolveScoreMetadata(score).title,
          revisionNumber: revision?.revisionNumber ?? null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forkedFrom]);

  if (!source) {
    return null;
  }

  return (
    <>
      <Badge
        bg="light"
        text="dark"
        className="cursor"
        onClick={() => setShowDetail(true)}
      >
        derivada de {source.title}
        {source.revisionNumber !== null && ` · v${source.revisionNumber}`}
      </Badge>
      {showDetail && (
        <ScoreDetailModal
          show
          scoreId={scoreId}
          onHide={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
