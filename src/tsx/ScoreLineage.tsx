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
}

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
    void (async () => {
      const docs = await getScoreForks(scoreId);
      setForks(
        await Promise.all(
          docs.map(async (fork) => ({
            id: fork.id,
            title: resolveScoreMetadata(fork).title,
            projectTitle: await projectTitle(fork.projectId),
          })),
        ),
      );
    })();
  }, [scoreId]);

  if (!source && forks.length === 0) {
    return null;
  }
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
          {forks.map((fork, i) => (
            <span key={fork.id}>
              {i > 0 && ", "}
              <Link to={`/score/${encodeURIComponent(fork.id)}`}>
                {fork.title}
              </Link>{" "}
              ({fork.projectTitle})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
