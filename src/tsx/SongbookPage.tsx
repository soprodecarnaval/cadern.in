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
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
  setSongbookPublished,
  softDeleteSongbook,
  type WithId,
} from "../lib/db";
import {
  canDeleteSongbook,
  canEditSongbook,
  canPublishSongbook,
  canRepinSongbook,
  isReviewer,
} from "../lib/roles";
import {
  REMOVED_SCORES_NOTE,
  fromSongbookRevision,
  hasNewerVersion,
  repinnedContent,
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
  NumberedSongbookScoreViewModel,
  SongbookItemViewModel,
} from "../../types/viewModels";
import { PDFGenerator } from "./PdfGenerator";
import { SongBar } from "./PlayerBar";
import { SongBookTable } from "./SongBookTable";
import { SongbookCoversEditor } from "./SongbookCoversEditor";

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
  const items = fromSongbookRevision(
    revision,
    await loadPinnedScores(revision),
  );
  return { songbook, revision, items };
}

/**
 * A songbook at its current revision (or `?versao=` for members). Admins edit
 * the current revision; every save creates a new one.
 */
export function SongbookPage() {
  const { slug: projectId, songbookSlug } = useParams<{
    slug: string;
    songbookSlug: string;
  }>();
  const [searchParams] = useSearchParams();
  const revisionParam = searchParams.get("versao");
  const role = useMemberRole(projectId);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null | "loading">("loading");
  const [editing, setEditing] = useState<"contents" | "covers" | null>(null);
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
  const handleEditDone = (saved: boolean) => {
    setEditing(null);
    if (saved) {
      setReloads((n) => n + 1);
    }
  };
  const isCurrent = revision.id === songbook.currentRevisionId;
  const stale = items.filter(
    (i): i is NumberedSongbookScoreViewModel =>
      !isSongbookSection(i) && hasNewerVersion(i),
  );
  const canRepin = isCurrent && canRepinSongbook(role);

  const handleRepin = async (scoreIds: string[]) => {
    if (!currentUser) {
      return;
    }
    const { content, note } = repinnedContent(revision, items, scoreIds);
    await createSongbookRevision(songbook.id, content, {
      createdBy: currentUser.uid,
      note,
    });
    setReloads((n) => n + 1);
  };

  const handleTogglePublished = async () => {
    await setSongbookPublished(songbook.id, !songbook.isPublished);
    setReloads((n) => n + 1);
  };

  return (
    <Container className="mt-4">
      <div className="d-flex align-items-baseline gap-2 mb-1">
        <h2 className="mb-0">{songbook.title}</h2>
        <span className="text-muted">versão #{revision.revisionNumber}</span>
        {!songbook.isPublished && <Badge bg="secondary">não publicado</Badge>}
        {!isCurrent && <Badge bg="warning">versão antiga</Badge>}
      </div>
      <p className="text-muted">
        <Link to={`/projects/${encodeURIComponent(projectId)}/songbooks`}>
          caderninhos do projeto
        </Link>
        {revision.note && <> · {revision.note}</>}
      </p>

      {editing === "contents" ? (
        <SongbookEditor
          projectId={projectId}
          songbook={songbook}
          initialItems={items}
          onDone={handleEditDone}
        />
      ) : (
        <>
          {isCurrent && editing === null && (
            <div className="d-flex gap-2 mb-3">
              {canEditSongbook(role) && (
                <>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => setEditing("contents")}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => setEditing("covers")}
                  >
                    Capas
                  </Button>
                </>
              )}
              {canRepin && stale.length > 0 && (
                <Button
                  size="sm"
                  variant="outline-warning"
                  onClick={() => void handleRepin(stale.map((i) => i.score.id))}
                >
                  Atualizar todas ({stale.length})
                </Button>
              )}
              {canPublishSongbook(role) && (
                <Button
                  size="sm"
                  variant={
                    songbook.isPublished ? "outline-secondary" : "success"
                  }
                  onClick={() => void handleTogglePublished()}
                >
                  {songbook.isPublished ? "Despublicar" : "Publicar"}
                </Button>
              )}
            </div>
          )}
          {editing === "covers" && (
            <SongbookCoversEditor
              songbook={songbook}
              revision={revision}
              onDone={handleEditDone}
            />
          )}
          <SongbookContents
            items={items}
            showNewerVersions={isReviewer(role)}
            onRepin={canRepin ? (id) => void handleRepin([id]) : undefined}
          />
          <PDFGenerator
            songBook={{ items }}
            covers={Object.fromEntries(
              Object.entries(revision.covers).map(([i, f]) => [i, f.url]),
            )}
          />
          {isReviewer(role) && (
            <SongbookHistory
              songbookId={songbook.id}
              currentRevisionId={songbook.currentRevisionId}
              shownRevisionId={revision.id}
            />
          )}
          {canDeleteSongbook(role) && (
            <DeleteSongbookSection
              songbook={songbook}
              onDeleted={() =>
                void navigate(
                  `/projects/${encodeURIComponent(projectId)}/songbooks`,
                )
              }
            />
          )}
        </>
      )}
    </Container>
  );
}

/** Owner-only; asks for the title. The songbook's scores are untouched. */
function DeleteSongbookSection({
  songbook,
  onDeleted,
}: {
  songbook: WithId<SongbookDoc>;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await softDeleteSongbook(songbook.id);
      onDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
      setPending(false);
    }
  };

  return (
    <section className="mt-5 border border-danger rounded p-3">
      <h5 className="text-danger">Zona de perigo</h5>
      <p className="mb-2">
        Excluir o caderninho não mexe nas partituras. Para confirmar, digite o
        título: <strong>{songbook.title}</strong>
      </p>
      <Form
        onSubmit={(e) => void handleDelete(e)}
        className="d-flex gap-2 align-items-start flex-wrap"
      >
        <Form.Control
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={songbook.title}
          style={{ width: 240 }}
        />
        <Button
          type="submit"
          variant="danger"
          disabled={pending || confirmation !== songbook.title}
        >
          {pending ? (
            <Spinner animation="border" size="sm" />
          ) : (
            "Excluir caderninho"
          )}
        </Button>
      </Form>
      {error && <div className="text-danger mt-2">{error}</div>}
    </section>
  );
}

function SongbookContents({
  items,
  showNewerVersions,
  onRepin,
}: {
  items: NumberedSongbookItemViewModel[];
  // Members see which scores have a newer version than the one pinned; the
  // public sees the songbook as published.
  showNewerVersions: boolean;
  // Given to editors and up: re-pins one score to its latest version.
  onRepin?: (scoreId: string) => void;
}) {
  const anyDeleted = items.some((i) => !isSongbookSection(i) && i.deleted);
  return (
    <>
      <Table size="sm" className={anyDeleted ? "mb-1" : "mb-4"}>
        <tbody>
          {items.map((item, i) =>
            isSongbookSection(item) ? (
              <tr key={`s-${i}`}>
                <th colSpan={4}>{item.title}</th>
              </tr>
            ) : (
              <tr
                key={item.score.id}
                className={item.deleted ? "text-muted" : ""}
              >
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
                <td className="text-end">
                  {showNewerVersions && hasNewerVersion(item) && (
                    <>
                      <Link to={`/score/${encodeURIComponent(item.score.id)}`}>
                        <Badge bg="warning" text="dark">
                          nova versão
                        </Badge>
                      </Link>
                      {onRepin && (
                        <Button
                          size="sm"
                          variant="link"
                          className="py-0"
                          onClick={() => onRepin(item.score.id)}
                        >
                          atualizar
                        </Button>
                      )}
                    </>
                  )}
                </td>
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
      await createSongbookRevision(
        songbook.id,
        toSongbookRevisionContent(items),
        {
          createdBy: currentUser.uid,
          note: note.trim(),
        },
      );
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
            placeholder="O que mudou nesta versão? (opcional)"
          />
          <div className="d-flex gap-2 mt-2">
            <Button disabled={pending} onClick={() => void handleSave()}>
              {pending ? (
                <Spinner animation="border" size="sm" />
              ) : (
                "Salvar versão"
              )}
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
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => onAdd(s)}
            >
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
            to={
              rev.id === currentRevisionId
                ? "?"
                : `?versao=${encodeURIComponent(rev.id)}`
            }
            active={rev.id === shownRevisionId}
          >
            Versão #{rev.revisionNumber} ·{" "}
            {rev.createdAt?.toDate().toLocaleDateString("pt-BR") ?? "—"}
            {rev.note && <> · {rev.note}</>}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </section>
  );
}
