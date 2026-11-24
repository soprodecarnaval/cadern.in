import { Page } from "../../atoms/Page";
import { Button } from "../../atoms/Button";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Col, Row, Spinner } from "react-bootstrap";

import { Link, useNavigate, useParams } from "react-router-dom";
import type { WithId } from "../../../lib/db";

import type { CommentAnchor, ReviewCommentDoc } from "../../../../types/docs";
import { commentThreads } from "../../../lib/comments";
import type { LoadedScore } from "../../../lib/loadScore";
import { canDeleteScore, canEditScoreMetadata, isEditor, isReviewer } from "../../../lib/roles";
import { FEATURE_FLAG_BROWSER_UPLOAD } from "../../../featureFlags";
import { uploadPath } from "../../../lib/uploadPath";
import { projectPath } from "../../../lib/routes";
import { useMemberRoleValue } from "../../../lib/useMemberRoleValue";

import type { ScorePin } from "../../components/scores/detail/ScoreDisplay";

export type ScorePageServices = Pick<
  typeof import("../../../lib/db"),
  "softDeleteScore" | "getComments" | "getMemberRole"
> & { loadScore: typeof import("../../../lib/loadScore").loadScore };

export function ScorePageView({
  services,
  currentUser,
  collabEnabled,
  components,
}: {
  services: ScorePageServices;
  currentUser: import("firebase/auth").User | null;
  collabEnabled: boolean;
  components: {
    ScoreDisplay: typeof import("../../components/scores/detail/ScoreDisplay").ScoreDisplay;
    ScoreLineage: typeof import("../../components/scores/detail/ScoreLineage").ScoreLineage;
    ScoreRevisionList: typeof import("../../components/scores/detail/ScoreRevisionList").ScoreRevisionList;
    ReviewCommentsPanel: typeof import("../../components/review/ReviewCommentsPanel").ReviewCommentsPanel;
    ScoreMetadataEditor: typeof import("./ScoreMetadataEditor").ScoreMetadataEditor;
  };
}) {
  const { scoreId, revisionId } = useParams<{
    scoreId: string;
    revisionId?: string;
  }>();
  const [score, setScore] = useState<LoadedScore | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const role = useMemberRoleValue(
    collabEnabled ? score?.projectId : undefined,
    currentUser?.uid,
    services.getMemberRole,
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
    void services.getComments(shownScoreId, shownRevisionId).then(setComments);
  }, [reviewing, shownScoreId, shownRevisionId, commentReloads, services]);

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
    services
      .loadScore(scoreId, revisionId, currentUser?.uid)
      .then(setScore)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro"));
  }, [scoreId, revisionId, currentUser, services]);

  const handleDelete = async () => {
    if (
      !score ||
      !confirm(`Excluir "${score.title}"? Ela some do site e do projeto.`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      await services.softDeleteScore(score.scoreId);
      void navigate(projectPath(score.projectId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <Page className="mt-4">
        <Alert variant="danger">{error}</Alert>
      </Page>
    );
  }

  if (!score) {
    return (
      <Page className="mt-4">
        <Spinner animation="border" />
      </Page>
    );
  }

  return (
    <Page className="mt-4">
      <div className="d-flex align-items-baseline gap-2 mb-1">
        <h2 className="mb-0">{score.title}</h2>
        <span className="text-muted">versão #{score.revisionNumber}</span>
        {collabEnabled && score.revisionId === score.publishedRevisionId && (
          <Badge bg="success">publicada</Badge>
        )}
      </div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <p className="mb-0"><Link to={projectPath(score.projectId)}>{score.projectTitle}</Link></p>
        <div className="d-flex gap-2">
          {role !== "loading" && canDeleteScore(role) && (
            <Button
              variant="danger-secondary"
              size="sm"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              Excluir partitura
            </Button>
          )}
          {role !== "loading" && canEditScoreMetadata(role) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Editar metadados
            </Button>
          )}
          {FEATURE_FLAG_BROWSER_UPLOAD && role !== "loading" && isEditor(role) && (
            <a
              className="btn btn-outline-secondary ds-button btn-sm"
              href={uploadPath({
                projectId: score.projectId,
                scoreId: score.scoreId,
                expectedScoreRevisionId: score.latestRevisionId,
                baseRevisionId: score.revisionId,
                mode: "reformat",
              })}
            >
              Reformatar
            </a>
          )}
          <a className="btn btn-outline-secondary ds-button btn-sm" href={score.msczUrl}
            download={`${score.title}.mscz`}>
            Baixar .mscz
          </a>
        </div>
      </div>
      {collabEnabled && (
        <components.ScoreLineage
          scoreId={score.scoreId}
          forkedFrom={score.forkedFrom}
        />
      )}
      <Row>
        <Col lg={reviewing ? 8 : 12}>
          <components.ScoreDisplay
            title={score.title}
            composer={score.composer}
            sub={score.sub}
            tags={score.tags}
            arrangementMidiUrl={score.arrangementMidiUrl}
            arrangement={score.arrangement}
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
              <components.ReviewCommentsPanel
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
      {collabEnabled && (
        <section className="mt-4">
          <h5>Versões</h5>
          <components.ScoreRevisionList
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
        <components.ScoreMetadataEditor
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
    </Page>
  );
}
