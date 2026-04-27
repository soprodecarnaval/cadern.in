import { useEffect, useState } from "react";
import { Alert, Button, Container, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { getScore, getRevision, getProject } from "../lib/db";
import { storagePathToUrl } from "../storage";
import { ScoreDisplay, type ScoreDisplayPart } from "./ScoreDisplay";

interface LoadedScore {
  scoreId: string;
  revisionId: string;
  revisionNumber: number;
  title: string;
  composer: string;
  sub: string;
  tags: string[];
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
    getRevision(scoreId, resolvedRevisionId),
    getProject(song.projectId),
  ]);
  if (!rev) {
    throw new Error("Revisão não encontrada");
  }
  const projectTitle = project?.title ?? song.projectId;

  return {
    scoreId,
    revisionId: resolvedRevisionId,
    revisionNumber: rev.revisionNumber,
    title: song.title,
    composer: song.composer,
    sub: song.sub,
    tags: song.tags,
    projectTitle,
    msczUrl: storagePathToUrl(rev.mscz),
    arrangementMidiUrl: rev.midi ? storagePathToUrl(rev.midi) : null,
    parts: rev.parts.map((part) => ({
      name: part.name,
      instrument: part.instrument,
      svgUrls: part.svg.map(storagePathToUrl),
      midiUrl: part.midi ? storagePathToUrl(part.midi) : null,
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
        <span className="text-muted">revisão #{score.revisionNumber}</span>
      </div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <p className="text-muted mb-0">{score.projectTitle}</p>
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
      <ScoreDisplay
        title={score.title}
        composer={score.composer}
        sub={score.sub}
        tags={score.tags}
        arrangementMidiUrl={score.arrangementMidiUrl}
        parts={score.parts}
      />
    </Container>
  );
}
