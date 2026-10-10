import { useEffect, useState } from "react";
import { Alert, Button, Container, Spinner } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import {
  getScore,
  getScoreRevision,
  getProject,
  softDeleteScore,
} from "../lib/db";
import { FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { canDeleteScore, canEditScoreMetadata } from "../lib/roles";
import {
  resolveScoreMetadata,
  uploadedScoreMetadata,
} from "../lib/scoreMetadata";
import { useMemberRole } from "../lib/useMemberRole";
import type { ScoreMetadata } from "../../types/docs";
import { ScoreDisplay, type ScoreDisplayPart } from "./ScoreDisplay";
import { ScoreMetadataEditor } from "./ScoreMetadataEditor";
import { ScoreRevisionList } from "./ScoreRevisionList";

interface LoadedScore extends ScoreMetadata {
  scoreId: string;
  revisionId: string;
  latestRevisionId: string;
  revisionNumber: number;
  uploaded: ScoreMetadata;
  projectId: string;
  projectTitle: string;
  msczUrl: string;
  arrangementMidiUrl: string | null;
  parts: ScoreDisplayPart[];
}

async function loadScore(
  scoreId: string,
  revisionId?: string,
): Promise<LoadedScore> {
  const song = await getScore(scoreId);
  if (!song || song.deletedAt) {
    throw new Error("Partitura não encontrada");
  }

  const resolvedRevisionId = revisionId ?? song.latestRevisionId;
  const [rev, project] = await Promise.all([
    getScoreRevision(scoreId, resolvedRevisionId),
    getProject(song.projectId),
  ]);
  if (!rev) {
    throw new Error("Versão não encontrada");
  }
  // A deleted project hides its scores (collab-flow §6).
  if (project?.deletedAt) {
    throw new Error("Partitura não encontrada");
  }
  const projectTitle = project?.title ?? song.projectId;

  return {
    scoreId,
    revisionId: resolvedRevisionId,
    latestRevisionId: song.latestRevisionId,
    revisionNumber: rev.revisionNumber,
    ...resolveScoreMetadata(song),
    uploaded: uploadedScoreMetadata(song),
    projectId: song.projectId,
    projectTitle,
    msczUrl: rev.mscz.url,
    arrangementMidiUrl: rev.midi.url || null,
    parts: rev.parts.map((part) => ({
      name: part.name,
      instrument: part.instrument,
      svgUrls: part.svg.map((f) => f.url),
      midiUrl: part.midi.url || null,
    })),
  };
}

export function ScorePage() {
  const { scoreId, revisionId } = useParams<{
    scoreId: string;
    revisionId?: string;
  }>();
  const [score, setScore] = useState<LoadedScore | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const role = useMemberRole(
    FEATURE_FLAG_COLLAB_FLOW ? score?.projectId : undefined,
  );

  useEffect(() => {
    if (!scoreId) {
      return;
    }
    setScore(null);
    setError("");
    loadScore(scoreId, revisionId)
      .then(setScore)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro"));
  }, [scoreId, revisionId]);

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
