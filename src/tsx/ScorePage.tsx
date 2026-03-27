import { useEffect, useState } from "react";
import { Alert, Button, Container, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { getSong, getRevision, getProject } from "../lib/db";
import { storagePathToUrl } from "../storage";
import { ScoreDisplay, type ScoreDisplayPart } from "./ScoreDisplay";

interface LoadedScore {
  songId: string;
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

async function loadScore(songId: string, revisionId?: string): Promise<LoadedScore> {
  const song = await getSong(songId);
  if (!song || song.deletedAt) throw new Error("Partitura não encontrada");

  const resolvedRevisionId = revisionId ?? song.latestRevisionId;
  const [rev, project] = await Promise.all([
    getRevision(songId, resolvedRevisionId),
    getProject(song.projectId),
  ]);
  if (!rev) throw new Error("Revisão não encontrada");
  const projectTitle = project?.title ?? song.projectId;

  return {
    songId,
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
  const { songId, revisionId } = useParams<{ songId: string; revisionId?: string }>();
  const [score, setScore] = useState<LoadedScore | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!songId) return;
    setScore(null);
    setError("");
    loadScore(songId, revisionId).then(setScore).catch((e) => setError(e.message));
  }, [songId, revisionId]);

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
