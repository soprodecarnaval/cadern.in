import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Col,
  Container,
  Row,
  Spinner,
} from "react-bootstrap";
import { useAuth } from "../auth";
import { useNavigate, useParams } from "react-router-dom";
import { softDeleteScore, getComments, type WithId } from "../lib/db";
import { FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { canDeleteScore, canEditScoreMetadata, isReviewer } from "../lib/roles";
import { loadScore, type LoadedScore } from "../lib/loadScore";
import { useMemberRole } from "../lib/useMemberRole";
import { commentThreads } from "../lib/comments";
import type { CommentAnchor, ReviewCommentDoc } from "../../types/docs";
import { ReviewCommentsPanel } from "./ReviewCommentsPanel";
import { ScoreDisplay, type ScorePin } from "./ScoreDisplay";
import { ScoreLineage } from "./ScoreLineage";
import { ScoreMetadataEditor } from "./ScoreMetadataEditor";
import { ScoreRevisionList } from "./ScoreRevisionList";

export function ScorePage() {
  const { scoreId, revisionId } = useParams<{
    scoreId: string;
    revisionId?: string;
  }>();
  const [score, setScore] = useState<LoadedScore | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const role = useMemberRole(
    FEATURE_FLAG_COLLAB_FLOW ? score?.projectId : undefined,
  );
  // Review comments: project members only (collab-flow §5.4).
  const reviewing = role !== "loading" && isReviewer(role) && !!currentUser;
  const [comments, setComments] = useState<WithId<ReviewCommentDoc>[]>([]);
  const [commentReloads, setCommentReloads] = useState(0);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null,
  );
  const [picking, setPicking] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(
    null,
  );

  const shownScoreId = score?.scoreId;
  const shownRevisionId = score?.revisionId;
  useEffect(() => {
    if (!reviewing || !shownScoreId || !shownRevisionId) {
      setComments([]);
      return;
    }
    void getComments(shownScoreId, shownRevisionId).then(setComments);
  }, [reviewing, shownScoreId, shownRevisionId, commentReloads]);

  const threads = useMemo(() => commentThreads(comments), [comments]);
  const pins: ScorePin[] = threads.flatMap((t) =>
    t.pinNumber !== null && t.root.anchor
      ? [{ id: t.root.id, number: t.pinNumber, anchor: t.root.anchor }]
      : [],
  );

  useEffect(() => {
    if (!scoreId) {
      return;
    }
    setScore(null);
    setError("");
    loadScore(scoreId, revisionId, currentUser?.uid)
      .then(setScore)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro"));
  }, [scoreId, revisionId, currentUser]);

  const handleDelete = async () => {
    if (
      !score ||
      !confirm(`Excluir "${score.title}"? Ela some do site e do projeto.`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      await softDeleteScore(score.scoreId);
      void navigate(`/projects/${encodeURIComponent(score.projectId)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (!score) {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <div className="d-flex align-items-baseline gap-2 mb-1">
        <h2 className="mb-0">{score.title}</h2>
        <span className="text-muted">versão #{score.revisionNumber}</span>
        {FEATURE_FLAG_COLLAB_FLOW &&
          score.revisionId === score.publishedRevisionId && (
            <Badge bg="success">publicada</Badge>
          )}
      </div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <p className="text-muted mb-0">{score.projectTitle}</p>
        <div className="d-flex gap-2">
          {role !== "loading" && canDeleteScore(role) && (
            <Button
              variant="outline-danger"
              size="sm"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              Excluir partitura
            </Button>
          )}
          {role !== "loading" && canEditScoreMetadata(role) && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Editar metadados
            </Button>
          )}
          <Button
            variant="outline-secondary"
            size="sm"
            as="a"
            href={score.msczUrl}
            download={`${score.title}.mscz`}
          >
            Baixar .mscz
          </Button>
        </div>
      </div>
      {FEATURE_FLAG_COLLAB_FLOW && (
        <ScoreLineage scoreId={score.scoreId} forkedFrom={score.forkedFrom} />
      )}
      <Row>
        <Col lg={reviewing ? 8 : 12}>
          <ScoreDisplay
            title={score.title}
            composer={score.composer}
            sub={score.sub}
            tags={score.tags}
            arrangementMidiUrl={score.arrangementMidiUrl}
            parts={score.parts}
            pinsProps={
              reviewing
                ? {
                    pins,
                    selectedPinId: selectedCommentId,
                    onPinClick: setSelectedCommentId,
                    picking,
                    onPick: (anchor) => {
                      setPendingAnchor(anchor);
                      setPicking(false);
                    },
                  }
                : undefined
            }
          />
        </Col>
        {reviewing && currentUser && (
          <Col lg={4}>
            <div style={{ position: "sticky", top: 16 }}>
              <ReviewCommentsPanel
                scoreId={score.scoreId}
                revisionId={score.revisionId}
                user={currentUser}
                threads={threads}
                selectedId={selectedCommentId}
                picking={picking}
                pendingAnchor={pendingAnchor}
                onStartPicking={() => setPicking((p) => !p)}
                onClearAnchor={() => setPendingAnchor(null)}
                onChanged={() => setCommentReloads((n) => n + 1)}
              />
            </div>
          </Col>
        )}
      </Row>
      {FEATURE_FLAG_COLLAB_FLOW && (
        <section className="mt-4">
          <h5>Versões</h5>
          <ScoreRevisionList
            scoreId={score.scoreId}
            projectId={score.projectId}
            currentRevisionId={score.revisionId}
            latestRevisionId={score.latestRevisionId}
            showCommentCounts={reviewing}
            reloadKey={commentReloads}
          />
        </section>
      )}
      {editing && (
        <ScoreMetadataEditor
          show
          scoreId={score.scoreId}
          uploaded={score.uploaded}
          current={score}
          onHide={() => setEditing(false)}
          onSaved={(override) =>
            setScore({ ...score, ...score.uploaded, ...override })
          }
        />
      )}
    </Container>
  );
}
