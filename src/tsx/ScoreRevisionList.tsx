import { useEffect, useState } from "react";
import { Badge, ListGroup, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
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
}: {
  scoreId: string;
  projectId: string;
  currentRevisionId: string;
  latestRevisionId: string;
}) {
  const [revisions, setRevisions] = useState<
    WithId<ScoreRevisionDoc>[] | null
  >(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void Promise.all([
      getScoreRevisions(scoreId),
      getProjectMembers(projectId),
    ]).then(([revs, members]) => {
      setRevisions(revs);
      setNames(new Map(members.map((m) => [m.uid, m.displayName])));
    });
  }, [scoreId, projectId]);

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
          {rev.id === latestRevisionId && <Badge bg="secondary">atual</Badge>}
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}
