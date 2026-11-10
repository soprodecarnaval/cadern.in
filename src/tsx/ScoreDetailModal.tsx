import { useEffect, useState } from "react";
import { Alert, Badge, Button, Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { loadScore, type LoadedScore } from "../lib/loadScore";
import { ScoreDisplay } from "./ScoreDisplay";
import { ScoreLineage } from "./ScoreLineage";
import { ScoreRevisionList } from "./ScoreRevisionList";
import { FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { useAuth } from "../auth";

/**
 * Quick lookup, not the reviewer workflow: no review-comments panel, no
 * metadata editing, no delete. Those stay full-page-only on ScorePage,
 * reachable via the "Abrir página completa" link below.
 */
export function ScoreDetailModal({
  show,
  onHide,
  scoreId,
  revisionId,
}: {
  show: boolean;
  onHide: () => void;
  scoreId: string;
  revisionId?: string;
}) {
  const { currentUser } = useAuth();
  const [score, setScore] = useState<LoadedScore | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) {
      return;
    }
    setScore(null);
    setError("");
    loadScore(scoreId, revisionId, currentUser?.uid)
      .then(setScore)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro"));
  }, [show, scoreId, revisionId, currentUser]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{score?.title ?? "Partitura"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {!error && !score && <Spinner animation="border" />}
        {score && (
          <>
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <span className="text-muted">versão #{score.revisionNumber}</span>
              {FEATURE_FLAG_COLLAB_FLOW &&
                score.revisionId === score.publishedRevisionId && (
                  <Badge bg="success">publicada</Badge>
                )}
            </div>
            <p className="text-muted">{score.projectTitle}</p>
            {FEATURE_FLAG_COLLAB_FLOW && (
              <ScoreLineage scoreId={score.scoreId} forkedFrom={score.forkedFrom} />
            )}
            <ScoreDisplay
              title={score.title}
              composer={score.composer}
              sub={score.sub}
              tags={score.tags}
              arrangementMidiUrl={score.arrangementMidiUrl}
              parts={score.parts}
            />
            {FEATURE_FLAG_COLLAB_FLOW && (
              <section className="mt-4">
                <h5>Versões</h5>
                <ScoreRevisionList
                  scoreId={score.scoreId}
                  projectId={score.projectId}
                  currentRevisionId={score.revisionId}
                  latestRevisionId={score.latestRevisionId}
                  showCommentCounts={false}
                  reloadKey={0}
                />
              </section>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {score && (
          <Link
            className="btn btn-outline-primary"
            to={`/score/${encodeURIComponent(score.scoreId)}/${encodeURIComponent(score.revisionId)}`}
          >
            Abrir página completa
          </Link>
        )}
        <Button variant="secondary" onClick={onHide}>
          Fechar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
