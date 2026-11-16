import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Col, Container, Row, Spinner } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import type { CommentAnchor, ReviewCommentDoc } from "../../types/docs";
import type { WithId } from "../lib/db";
import { commentThreads } from "../lib/comments";
import { isEditor } from "../lib/roles";
import { resolveScoreMetadata } from "../lib/scoreMetadata";
import { publicSongbookPath, songbookPath } from "../lib/songbook";
import { buildExportDeepLink } from "../../types/exportDeepLink";

import type { ScoreDisplayPart, ScorePin } from "./ScoreDisplay";

interface LoadedScoreThread {
  songbookId: string;
  songbookTitle: string;
  songbookProjectId: string;
  // The songbook's revision this page loaded against — the "nova versão"
  // launch link's expected revision (010), so a stale songbook never gets a
  // silent re-pin after the upload.
  songbookRevisionId: string;
  // The score's own project, which may differ from the songbook's — review
  // is authorized by the songbook's membership either way (009); mutating
  // the score itself is not (unaffected by this page, which has no such
  // controls).
  foreign: boolean;
  revisionId: string;
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  arrangementMidiUrl: string | null;
  parts: ScoreDisplayPart[];
}

async function load(
  projectId: string,
  songbookSlug: string,
  scoreId: string,
  services: SongbookScorePageServices,
): Promise<LoadedScoreThread | null | "missing"> {
  const songbook = await services.getSongbook(projectId, songbookSlug);
  if (!songbook || songbook.deletedAt) {
    return null;
  }
  const revision = await services
    .getSongbookRevision(songbook.id, songbook.currentRevisionId)
    .catch(() => null);
  const revisionId = revision?.pins[scoreId];
  if (!revision || !revisionId) {
    return "missing";
  }
  const [score, scoreRevision] = await Promise.all([
    services.getScore(scoreId),
    services.getScoreRevision(scoreId, revisionId),
  ]);
  if (!score || !scoreRevision) {
    return "missing";
  }
  return {
    songbookId: songbook.id,
    songbookTitle: songbook.title,
    songbookProjectId: songbook.projectId,
    songbookRevisionId: songbook.currentRevisionId,
    foreign: score.projectId !== songbook.projectId,
    revisionId,
    ...resolveScoreMetadata(score),
    arrangementMidiUrl: scoreRevision.midi.url || null,
    parts: scoreRevision.parts.map((part) => ({
      name: part.name,
      instrument: part.instrument,
      svgUrls: part.svg.map((f) => f.url),
      midiUrl: part.midi.url || null,
    })),
  };
}

/**
 * Member-only songbook-scoped score review (009): shows the revision this
 * songbook pins, not the score's latest, with a comment thread that belongs
 * to the songbook. Authorized by the songbook's project membership, even for
 * a score owned by a different project — reviewing never grants mutation
 * rights over that score, and this page has no edit/delete controls at all.
 */
export type SongbookScorePageServices = {
  getSongbookComments: (
    songbookId: string,
    scoreId: string,
    revisionId: string,
  ) => Promise<WithId<ReviewCommentDoc>[]>;
  addSongbookComment: (
    songbookId: string,
    scoreId: string,
    revisionId: string,
    input: {
      authorId: string;
      authorName: string;
      body: string;
      parentId: string | null;
      anchor: CommentAnchor | null;
    },
  ) => Promise<string>;
  editSongbookComment: (
    songbookId: string,
    scoreId: string,
    revisionId: string,
    commentId: string,
    body: string,
  ) => Promise<void>;
  softDeleteSongbookComment: (
    songbookId: string,
    scoreId: string,
    revisionId: string,
    commentId: string,
  ) => Promise<void>;
} & Pick<
  typeof import("../lib/db"),
  "getSongbook" | "getSongbookRevision" | "getScore" | "getScoreRevision"
>;

export function SongbookScorePageView({
  services,
  currentUser,
  role,
  components,
}: {
  services: SongbookScorePageServices;
  currentUser: import("firebase/auth").User | null;
  role: import("../lib/roles").Role | "loading";
  components: {
    ScoreDisplay: typeof import("./ScoreDisplay").ScoreDisplay;
    ReviewCommentsPanel: typeof import("./ReviewCommentsPanelView").ReviewCommentsPanelView;
  };
}) {
  const { slug: projectId, songbookSlug, scoreId } = useParams<{
    slug: string;
    songbookSlug: string;
    scoreId: string;
  }>();
  const [loaded, setLoaded] = useState<
    LoadedScoreThread | null | "missing" | "loading"
  >("loading");
  const [comments, setComments] = useState<WithId<ReviewCommentDoc>[]>([]);
  const [commentReloads, setCommentReloads] = useState(0);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null,
  );
  const [picking, setPicking] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(
    null,
  );

  const isMember = role !== "loading" && role !== undefined;

  useEffect(() => {
    if (!projectId || !songbookSlug || !scoreId || !isMember) {
      return;
    }
    setLoaded("loading");
    void load(projectId, songbookSlug, scoreId, services).then(setLoaded);
  }, [projectId, songbookSlug, scoreId, isMember, services]);

  useEffect(() => {
    if (!loaded || loaded === "loading" || loaded === "missing" || !scoreId) {
      setComments([]);
      return;
    }
    void services
      .getSongbookComments(loaded.songbookId, scoreId, loaded.revisionId)
      .then(setComments);
  }, [loaded, scoreId, commentReloads, services]);

  const threads = useMemo(() => commentThreads(comments), [comments]);
  const pins: ScorePin[] = threads.flatMap((t) =>
    t.pinNumber !== null && t.root.anchor
      ? [{ id: t.root.id, number: t.pinNumber, anchor: t.root.anchor }]
      : [],
  );

  if (role === "loading") {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!isMember) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">
          Você não é membro deste projeto.{" "}
          {projectId && songbookSlug && (
            <Link to={publicSongbookPath(projectId, songbookSlug)}>
              Ver caderninho público
            </Link>
          )}
        </Alert>
      </Container>
    );
  }

  if (loaded === "loading") {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (loaded === "missing") {
    return (
      <Container className="mt-4">
        <Alert variant="warning">
          Esta partitura não está mais neste caderninho.{" "}
          {projectId && songbookSlug && (
            <Link to={songbookPath(projectId, songbookSlug)}>
              Voltar ao caderninho
            </Link>
          )}
        </Alert>
      </Container>
    );
  }

  if (!loaded || !projectId || !songbookSlug || !scoreId) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Caderninho não encontrado.</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
        <div className="d-flex align-items-baseline gap-2">
          <h2 className="mb-0">{loaded.title}</h2>
          {loaded.foreign && <Badge bg="warning">de outro projeto</Badge>}
        </div>
        {isEditor(role) && (
          <Button
            size="sm"
            variant="outline-primary"
            as="a"
            href={buildExportDeepLink({
              projectId: loaded.songbookProjectId,
              scoreId,
              expectedScoreRevisionId: loaded.revisionId,
              songbookId: loaded.songbookId,
              expectedSongbookRevisionId: loaded.songbookRevisionId,
            })}
          >
            Enviar nova versão
          </Button>
        )}
      </div>
      <p className="text-muted mb-3">
        Fixada em{" "}
        <Link to={songbookPath(projectId, songbookSlug)}>
          {loaded.songbookTitle}
        </Link>
      </p>
      <Row>
        <Col lg={8}>
          <components.ScoreDisplay
            title={loaded.title}
            composer={loaded.composer}
            sub={loaded.sub}
            tags={loaded.tags}
            arrangementMidiUrl={loaded.arrangementMidiUrl}
            parts={loaded.parts}
            pinsProps={{
              pins,
              selectedPinId: selectedCommentId,
              onPinClick: setSelectedCommentId,
              picking,
              onPick: (anchor) => {
                setPendingAnchor(anchor);
                setPicking(false);
              },
            }}
          />
        </Col>
        {currentUser && (
          <Col lg={4}>
            <div style={{ position: "sticky", top: 16 }}>
              <components.ReviewCommentsPanel
                services={{
                  addComment: (_sc, rev, input) =>
                    services.addSongbookComment(
                      loaded.songbookId,
                      scoreId,
                      rev,
                      input,
                    ),
                  editComment: (_sc, rev, commentId, body) =>
                    services.editSongbookComment(
                      loaded.songbookId,
                      scoreId,
                      rev,
                      commentId,
                      body,
                    ),
                  softDeleteComment: (_sc, rev, commentId) =>
                    services.softDeleteSongbookComment(
                      loaded.songbookId,
                      scoreId,
                      rev,
                      commentId,
                    ),
                }}
                scoreId={scoreId}
                revisionId={loaded.revisionId}
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
    </Container>
  );
}
