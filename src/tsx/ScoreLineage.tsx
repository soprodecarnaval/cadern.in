import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getProject,
  getScore,
  getScoreForks,
  getScoreRevision,
} from "../lib/db";
import { resolveScoreMetadata } from "../lib/scoreMetadata";
import type { ScoreData } from "../../types/docs";

interface Source {
  title: string;
  projectTitle: string;
  revisionNumber: number | null;
  deleted: boolean;
}

interface Fork {
  id: string;
  title: string;
  projectTitle: string;
  createdAt: number;
}

const FORKS_SHOWN = 5;

const projectTitle = async (id: string) => (await getProject(id))?.title ?? id;

/** Where this score was forked from, and the forks made from it. */
export function ScoreLineage({
  scoreId,
  forkedFrom,
}: {
  scoreId: string;
  forkedFrom: ScoreData["forkedFrom"];
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [forks, setForks] = useState<Fork[]>([]);
  const [showAllForks, setShowAllForks] = useState(false);
  const sourceId = forkedFrom?.scoreId;
  const sourceRevisionId = forkedFrom?.revisionId;

  useEffect(() => {
    setSource(null);
    if (!sourceId || !sourceRevisionId) {
      return;
    }
    void (async () => {
      const [score, revision] = await Promise.all([
        getScore(sourceId),
        getScoreRevision(sourceId, sourceRevisionId),
      ]);
      if (score) {
        setSource({
          title: resolveScoreMetadata(score).title,
          projectTitle: await projectTitle(score.projectId),
          revisionNumber: revision?.revisionNumber ?? null,
          deleted: !!score.deletedAt,
        });
      }
    })();
  }, [sourceId, sourceRevisionId]);

  useEffect(() => {
    setShowAllForks(false);
    void (async () => {
      const docs = await getScoreForks(scoreId);
      const resolved = await Promise.all(
        docs.map(async (fork) => ({
          id: fork.id,
          title: resolveScoreMetadata(fork).title,
          projectTitle: await projectTitle(fork.projectId),
          createdAt: fork.createdAt?.toMillis() ?? 0,
        })),
      );
      resolved.sort((a, b) => b.createdAt - a.createdAt);
      setForks(resolved);
    })();
  }, [scoreId]);

  if (!source && forks.length === 0) {
    return null;
  }
  const shownForks = showAllForks ? forks : forks.slice(0, FORKS_SHOWN);
  const hiddenForksCount = forks.length - shownForks.length;
  return (
    <div className="small text-muted mb-3">
      {source && sourceId && sourceRevisionId && (
        <div>
          derivada de{" "}
          {source.deleted ? (
            <strong>{source.title}</strong>
          ) : (
            <Link
              to={`/score/${encodeURIComponent(sourceId)}/${encodeURIComponent(sourceRevisionId)}`}
            >
              {source.title}
            </Link>
          )}{" "}
          ({source.projectTitle})
          {source.revisionNumber !== null &&
            ` · versão ${source.revisionNumber}`}
        </div>
      )}
      {forks.length > 0 && (
        <div>
          derivações:{" "}
          {shownForks.map((fork, i) => (
            <span key={fork.id}>
              {i > 0 && ", "}
              <Link to={`/score/${encodeURIComponent(fork.id)}`}>
                {fork.title}
              </Link>{" "}
              ({fork.projectTitle})
            </span>
          ))}
          {hiddenForksCount > 0 && (
            <>
              {" "}
              <button
                type="button"
                className="btn btn-link btn-sm p-0 align-baseline"
                onClick={() => setShowAllForks(true)}
              >
                mostrar mais ({hiddenForksCount})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
