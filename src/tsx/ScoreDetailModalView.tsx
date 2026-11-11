import { useEffect, useState } from "react";
import { Alert, Badge, Button, Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import type { LoadedScore } from "../lib/loadScore";

/**
 * Quick lookup, not the reviewer workflow: no review-comments panel, no
 * metadata editing, no delete. Those stay full-page-only on ScorePage,
 * reachable via the "Abrir página completa" link below.
 */
export type ScoreDetailModalServices = {
  loadScore: typeof import("../lib/loadScore").loadScore;
};

export function ScoreDetailModalView({
  services,
  currentUser,
  collabEnabled,
  components,

  show,
  onHide,
  scoreId,
  revisionId,
}: {
  services: ScoreDetailModalServices;
  currentUser: import("firebase/auth").User | null;
  collabEnabled: boolean;
  components: {
    ScoreDisplay: typeof import("./ScoreDisplay").ScoreDisplay;
    ScoreLineage: typeof import("./ScoreLineage").ScoreLineage;
    ScoreRevisionList: typeof import("./ScoreRevisionList").ScoreRevisionList;
  };

  show: boolean;
  onHide: () => void;
  scoreId: string;
  revisionId?: string;
}) {
  const [score, setScore] = useState<LoadedScore | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) {
      return;
    }
    setScore(null);
    setError("");
    services
      .loadScore(scoreId, revisionId, currentUser?.uid)
      .then(setScore)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro"));
  }, [show, scoreId, revisionId, currentUser, services]);

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
              {collabEnabled &&
                score.revisionId === score.publishedRevisionId && (
                  <Badge bg="success">publicada</Badge>
                )}
            </div>
            <p className="text-muted">{score.projectTitle}</p>
            {collabEnabled && (
              <components.ScoreLineage
                scoreId={score.scoreId}
                forkedFrom={score.forkedFrom}
              />
            )}
            <components.ScoreDisplay
              title={score.title}
              composer={score.composer}
              sub={score.sub}
              tags={score.tags}
              arrangementMidiUrl={score.arrangementMidiUrl}
              parts={score.parts}
            />
            {collabEnabled && (
              <section className="mt-4">
                <h5>Versões</h5>
                <components.ScoreRevisionList
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
