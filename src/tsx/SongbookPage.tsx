import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Container,
  Form,
  ListGroup,
  Spinner,
  Table,
} from "react-bootstrap";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  createSongbookRevision,
  getProjectScoreLinks,
  getProjectScores,
  getScore,
  getScoreRevision,
  getSongbook,
  getSongbookRevision,
  getSongbookRevisions,
  type WithId,
} from "../lib/db";
import { isAdmin, isReviewer } from "../lib/roles";
import {
  REMOVED_SCORES_NOTE,
  fromSongbookRevision,
  isSongbookSection,
  songbookScore,
  toSongbookRevisionContent,
} from "../lib/songbook";
import { loadPinnedScores } from "../lib/songbookScores";
import { useMemberRole } from "../lib/useMemberRole";
import { toScoreViewModel } from "../lib/viewModels";
import type { SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import type {
  PlayingPartViewModel,
  ScoreViewModel,
  NumberedSongbookItemViewModel,
  SongbookItemViewModel,
} from "../../types/viewModels";
import { PDFGenerator } from "./PdfGenerator";
import { SongBar } from "./PlayerBar";
import { SongBookTable } from "./SongBookTable";

interface Loaded {
  songbook: WithId<SongbookDoc>;
  revision: WithId<SongbookRevisionDoc>;
  items: NumberedSongbookItemViewModel[];
}

async function load(
  projectId: string,
  slug: string,
  revisionId: string | null,
): Promise<Loaded | null> {
  const songbook = await getSongbook(projectId, slug);
  if (!songbook || songbook.deletedAt) {
    return null;
  }
  const revision = await getSongbookRevision(
    songbook.id,
    revisionId ?? songbook.currentRevisionId,
  ).catch(() => null);
  if (!revision) {
    return null;
  }
  const items = fromSongbookRevision(revision, await loadPinnedScores(revision));
  return { songbook, revision, items };
}

/**
 * A songbook at its current revision (or `?revisao=` for members). Admins edit
 * the current revision; every save creates a new one.
 */
export function SongbookPage() {
  const { slug: projectId, songbookSlug } = useParams<{
    slug: string;
    songbookSlug: string;
  }>();
  const [searchParams] = useSearchParams();
  const revisionParam = searchParams.get("revisao");
  const role = useMemberRole(projectId);
  const [loaded, setLoaded] = useState<Loaded | null | "loading">("loading");
  const [editing, setEditing] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!projectId || !songbookSlug) {
      return;
    }
    setLoaded("loading");
    void load(projectId, songbookSlug, revisionParam).then(setLoaded);
  }, [projectId, songbookSlug, revisionParam, reloads]);

  if (loaded === "loading" || role === "loading") {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }
  if (!loaded || !projectId) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Caderninho não encontrado.</Alert>
      </Container>
    );
  }

  const { songbook, revision, items } = loaded;
  const isCurrent = revision.id === songbook.currentRevisionId;

  return (
    <Container className="mt-4">
      <div className="d-flex align-items-baseline gap-2 mb-1">
        <h2 className="mb-0">{songbook.title}</h2>
        <span className="text-muted">revisão #{revision.revisionNumber}</span>
        {!songbook.isPublished && <Badge bg="secondary">não publicado</Badge>}
        {!isCurrent && <Badge bg="warning">revisão antiga</Badge>}
      </div>
      <p className="text-muted">
        <Link to={`/projects/${encodeURIComponent(projectId)}/songbooks`}>
          caderninhos do projeto
        </Link>
        {revision.note && <> · {revision.note}</>}
      </p>

      {editing ? (
        <SongbookEditor
          projectId={projectId}
          songbook={songbook}
          initialItems={items}
          onDone={(saved) => {
            setEditing(false);
            if (saved) {
              setReloads((n) => n + 1);
            }
          }}
        />
      ) : (
        <>
          {isCurrent && isAdmin(role) && (
            <Button
              size="sm"
              variant="outline-primary"
              className="mb-3"
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
          )}
          <SongbookContents items={items} />
          <PDFGenerator songBook={{ items }} />
          {isReviewer(role) && (
            <SongbookHistory
              songbookId={songbook.id}
              currentRevisionId={songbook.currentRevisionId}
              shownRevisionId={revision.id}
            />
          )}
        </>
      )}
    </Container>
  );
}

function SongbookContents({
  items,
}: {
  items: NumberedSongbookItemViewModel[];
}) {
  const anyDeleted = items.some((i) => !isSongbookSection(i) && i.deleted);
  return (
    <>
      <Table size="sm" className={anyDeleted ? "mb-1" : "mb-4"}>
        <tbody>
          {items.map((item, i) =>
            isSongbookSection(item) ? (
              <tr key={`s-${i}`}>
                <th colSpan={3}>{item.title}</th>
              </tr>
            ) : (
              <tr key={item.score.id} className={item.deleted ? "text-muted" : ""}>
                <td className="text-muted" style={{ width: 40 }}>
                  {item.index}
                </td>
                <td>
                  {item.deleted ? (
                    <s>{item.score.title}</s>
                  ) : (
                    <Link to={`/score/${encodeURIComponent(item.score.id)}`}>
                      {item.score.title}
                    </Link>
                  )}
                </td>
                <td className="text-muted">{item.score.composer}</td>
              </tr>
            ),
          )}
        </tbody>
      </Table>
      {anyDeleted && (
        <p className="text-muted small mb-4">{REMOVED_SCORES_NOTE}</p>
      )}
    </>
  );
}

function SongbookEditor({
  projectId,
  songbook,
  initialItems,
  onDone,
}: {
  projectId: string;
  songbook: WithId<SongbookDoc>;
  initialItems: SongbookItemViewModel[];
  onDone: (saved: boolean) => void;
}) {
  const { currentUser } = useAuth();
  const [items, setItems] = useState(initialItems);
  const [note, setNote] = useState("");
  const [playingPart, setPlayingPart] = useState<PlayingPartViewModel | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = (score: ScoreViewModel, checked: boolean) =>
    setItems((prev) =>
      checked
        ? [...prev, songbookScore(score)]
        : prev.filter((r) => isSongbookSection(r) || r.score.id !== score.id),
    );

  const handleSave = async () => {
    if (!currentUser) {
      return;
    }
    setPending(true);
    setError("");
    try {
      await createSongbookRevision(songbook.id, toSongbookRevisionContent(items), {
        createdBy: currentUser.uid,
        note: note.trim(),
      });
      onDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setPending(false);
    }
  };

  return (
    <>
      <SongBar info={playingPart} />
      <div className="row">
        <div className="col-sm-6">
          <h5>Partituras do projeto</h5>
          <ProjectScorePicker
            projectId={projectId}
            selected={items}
            onAdd={(score) => handleSelect(score, true)}
          />
        </div>
        <div className="col-sm-6">
          <h5>Caderninho</h5>
          <SongBookTable
            rows={items}
            setItems={setItems}
            handleSelect={handleSelect}
            handleClear={() => setItems([])}
            onSetPlayingPart={setPlayingPart}
          />
          <Form.Control
            className="mt-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que mudou nesta revisão? (opcional)"
          />
          <div className="d-flex gap-2 mt-2">
            <Button disabled={pending} onClick={() => void handleSave()}>
              {pending ? <Spinner animation="border" size="sm" /> : "Salvar revisão"}
            </Button>
            <Button variant="secondary" onClick={() => onDone(false)}>
              Cancelar
            </Button>
          </div>
          {error && <div className="text-danger mt-2">{error}</div>}
        </div>
      </div>
    </>
  );
}

/** The project's own and linked scores, at their latest revision. */
function ProjectScorePicker({
  projectId,
  selected,
  onAdd,
}: {
  projectId: string;
  selected: SongbookItemViewModel[];
  onAdd: (score: ScoreViewModel) => void;
}) {
  const [scores, setScores] = useState<ScoreViewModel[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void (async () => {
      const [own, links] = await Promise.all([
        getProjectScores(projectId),
        getProjectScoreLinks(projectId),
      ]);
      const linked = await Promise.all(links.map((l) => getScore(l.scoreId)));
      const all = [...own, ...linked].filter(
        (s): s is NonNullable<typeof s> => !!s && !s.deletedAt,
      );
      const viewModels = await Promise.all(
        all.map(async (s) => {
          const rev = await getScoreRevision(s.id, s.latestRevisionId);
          return rev ? toScoreViewModel(s, rev, s.projectId) : null;
        }),
      );
      setScores(viewModels.filter((v): v is ScoreViewModel => v !== null));
    })();
  }, [projectId]);

  const selectedIds = useMemo(
    () =>
      new Set(
        selected.flatMap((i) => (isSongbookSection(i) ? [] : [i.score.id])),
      ),
    [selected],
  );

  if (!scores) {
    return <Spinner animation="border" size="sm" />;
  }
  const needle = filter.trim().toLocaleLowerCase("pt-BR");
  const shown = scores.filter(
    (s) =>
      !selectedIds.has(s.id) &&
      `${s.title} ${s.composer}`.toLocaleLowerCase("pt-BR").includes(needle),
  );

  return (
    <>
      <Form.Control
        className="mb-2"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar"
      />
      <ListGroup style={{ maxHeight: 480, overflowY: "auto" }}>
        {shown.map((s) => (
          <ListGroup.Item
            key={s.id}
            className="d-flex justify-content-between align-items-center"
          >
            <span>
              {s.title} <span className="text-muted">{s.composer}</span>
              {s.projectId !== projectId && (
                <Badge bg="light" text="dark" className="ms-2">
                  vinculada
                </Badge>
              )}
            </span>
            <Button size="sm" variant="outline-primary" onClick={() => onAdd(s)}>
              Adicionar
            </Button>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </>
  );
}

function SongbookHistory({
  songbookId,
  currentRevisionId,
  shownRevisionId,
}: {
  songbookId: string;
  currentRevisionId: string;
  shownRevisionId: string;
}) {
  const [revisions, setRevisions] = useState<
    WithId<SongbookRevisionDoc>[] | null
  >(null);

  useEffect(() => {
    void getSongbookRevisions(songbookId).then(setRevisions);
  }, [songbookId, currentRevisionId]);

  if (!revisions) {
    return null;
  }
  return (
    <section className="mt-4">
      <h5>Histórico</h5>
      <ListGroup>
        {revisions.map((rev) => (
          <ListGroup.Item
            key={rev.id}
            action
            as={Link}
            to={rev.id === currentRevisionId ? "?" : `?revisao=${encodeURIComponent(rev.id)}`}
            active={rev.id === shownRevisionId}
          >
            Revisão #{rev.revisionNumber} ·{" "}
            {rev.createdAt?.toDate().toLocaleDateString("pt-BR") ?? "—"}
            {rev.note && <> · {rev.note}</>}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </section>
  );
}
