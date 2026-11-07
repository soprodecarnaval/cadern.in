import { useEffect, useState } from "react";
import { Badge, ListGroup, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  countComments,
  getProjectMembers,
  getScoreRevisions,
  type WithId,
} from "../lib/db";
import type { ScoreRevisionDoc } from "../../types/docs";

// Shown for uploaders who are no longer project members (member docs are the
// only readable source of names).
export const UNKNOWN_UPLOADER = "—";

function formatDate(revision: ScoreRevisionDoc): string {
  return revision.uploadedAt?.toDate().toLocaleDateString("pt-BR") ?? "—";
}

export function ScoreRevisionList({
  scoreId,
  projectId,
  currentRevisionId,
  latestRevisionId,
  showCommentCounts,
  reloadKey,
}: {
  scoreId: string;
  projectId: string;
  currentRevisionId: string;
  latestRevisionId: string;
  // Members only; counts never carry over, so the latest's reads as open
  // feedback (collab-flow §5.4).
  showCommentCounts: boolean;
  // Changes when comments change, to refresh the counts.
  reloadKey: number;
}) {
  const [revisions, setRevisions] = useState<WithId<ScoreRevisionDoc>[] | null>(
    null,
  );
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    void Promise.all([
      getScoreRevisions(scoreId),
      getProjectMembers(projectId),
    ]).then(([revs, members]) => {
      setRevisions(revs);
      setNames(new Map(members.map((m) => [m.uid, m.displayName])));
    });
  }, [scoreId, projectId]);

  useEffect(() => {
    if (!showCommentCounts || !revisions) {
      return;
    }
    void Promise.all(
      revisions.map(
        async (rev) => [rev.id, await countComments(scoreId, rev.id)] as const,
      ),
    ).then((entries) => setCounts(new Map(entries)));
  }, [showCommentCounts, revisions, scoreId, reloadKey]);

  if (!revisions) {
    return <Spinner animation="border" size="sm" />;
  }

  return (
    <ListGroup>
      {revisions.map((rev) => (
        <ListGroup.Item
          key={rev.id}
          action
          as={Link}
          to={`/score/${encodeURIComponent(scoreId)}/${encodeURIComponent(rev.id)}`}
          active={rev.id === currentRevisionId}
          className="d-flex justify-content-between align-items-center"
        >
          <span>
            Versão #{rev.revisionNumber} · {formatDate(rev)} ·{" "}
            {names.get(rev.uploadedBy) ?? UNKNOWN_UPLOADER}
          </span>
          <span className="d-flex gap-2">
            {showCommentCounts && !!counts.get(rev.id) && (
              <Badge bg="info">
                {counts.get(rev.id)} comentário
                {counts.get(rev.id) === 1 ? "" : "s"}
              </Badge>
            )}
            {rev.id === latestRevisionId && <Badge bg="secondary">atual</Badge>}
          </span>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}
