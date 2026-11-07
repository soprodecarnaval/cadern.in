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
  getAllProjects,
  getAllScores,
  getProjectScores,
  getScoreRevision,
  getSongbook,
  getSongbookRevision,
  getSongbookRevisions,
  setSongbookPublished,
  softDeleteSongbook,
  swapSongbookEntryToFork,
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
import { resolveScoreMetadata } from "../lib/scoreMetadata";
import type {
  ScoreDoc,
  SongbookDoc,
  SongbookRevisionDoc,
} from "../../types/docs";
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
  const [forks, setForks] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!projectId || !songbookSlug) {
      return;
    }
    setLoaded("loading");
    void load(projectId, songbookSlug, revisionParam).then(setLoaded);
  }, [projectId, songbookSlug, revisionParam, reloads]);

  // This project's forks, by the score they derive from.
  const isMember = role !== "loading" && isReviewer(role);
  useEffect(() => {
    if (!projectId || !isMember) {
      setForks(new Map());
      return;
    }
    void getProjectScores(projectId).then((scores) =>
      setForks(
        new Map(
          scores.flatMap((s) =>
            s.forkedFrom ? [[s.forkedFrom.scoreId, s.id] as const] : [],
          ),
        ),
      ),
    );
  }, [projectId, isMember, reloads]);

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

  const handleSwap = async (scoreId: string, forkId: string) => {
    await swapSongbookEntryToFork(songbook.id, scoreId, forkId);
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
            forks={forks}
            onSwap={
              canRepin
                ? (scoreId, forkId) => void handleSwap(scoreId, forkId)
                : undefined
            }
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
  forks,
  onSwap,
}: {
  items: NumberedSongbookItemViewModel[];
  // Members see which scores have a newer version than the one pinned; the
  // public sees the songbook as published.
  showNewerVersions: boolean;
  // Given to editors and up: re-pins one score to its latest version.
  onRepin?: (scoreId: string) => void;
  // This project's forks, by the score they derive from.
  forks: Map<string, string>;
  // Given to editors and up: replaces an entry's score with its fork.
  onSwap?: (scoreId: string, forkId: string) => void;
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
                  {!item.deleted && forks.has(item.score.id) && (
                    <>
                      <Link
                        to={`/score/${encodeURIComponent(forks.get(item.score.id)!)}`}
                      >
                        <Badge bg="info" text="dark">
                          derivação disponível
                        </Badge>
                      </Link>
                      {onSwap && (
                        <Button
                          size="sm"
                          variant="link"
                          className="py-0"
                          onClick={() =>
                            onSwap(item.score.id, forks.get(item.score.id)!)
                          }
                        >
                          trocar pela derivação
                        </Button>
                      )}
                    </>
                  )}
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
          <h5>Partituras</h5>
          <ScorePicker
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

interface PickerScore {
  doc: WithId<ScoreDoc>;
  title: string;
  composer: string;
  projectTitle: string;
}

// Enough to find a score by filtering; rendering every score would be slow.
const PICKER_LIMIT = 100;

/**
 * Every live score of every live project, the project's own first. A score
 * enters the songbook at its latest version.
 */
function ScorePicker({
  projectId,
  selected,
  onAdd,
}: {
  projectId: string;
  selected: SongbookItemViewModel[];
  onAdd: (score: ScoreViewModel) => void;
}) {
  const [scores, setScores] = useState<PickerScore[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void (async () => {
      const [docs, projects] = await Promise.all([
        getAllScores(),
        getAllProjects(),
      ]);
      const titles = new Map(projects.map((p) => [p.id, p.title]));
      const live = docs.flatMap((doc): PickerScore[] => {
        const projectTitle = titles.get(doc.projectId);
        return projectTitle && !doc.deletedAt && doc.latestRevisionId
          ? [{ doc, ...resolveScoreMetadata(doc), projectTitle }]
          : [];
      });
      const own = (s: PickerScore) => (s.doc.projectId === projectId ? 0 : 1);
      setScores(
        live.sort(
          (a, b) => own(a) - own(b) || a.title.localeCompare(b.title, "pt-BR"),
        ),
      );
    })();
  }, [projectId]);

  const selectedIds = useMemo(
    () =>
      new Set(
        selected.flatMap((i) => (isSongbookSection(i) ? [] : [i.score.id])),
      ),
    [selected],
  );

  const handleAdd = async ({ doc, projectTitle }: PickerScore) => {
    const revision = await getScoreRevision(doc.id, doc.latestRevisionId);
    if (revision) {
      onAdd(toScoreViewModel(doc, revision, projectTitle));
    }
  };

  if (!scores) {
    return <Spinner animation="border" size="sm" />;
  }
  const needle = filter.trim().toLocaleLowerCase("pt-BR");
  const matches = scores.filter(
    (s) =>
      !selectedIds.has(s.doc.id) &&
      `${s.title} ${s.composer} ${s.projectTitle}`
        .toLocaleLowerCase("pt-BR")
        .includes(needle),
  );

  return (
    <>
      <Form.Control
        className="mb-2"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por título, compositor ou projeto"
      />
      <ListGroup style={{ maxHeight: 480, overflowY: "auto" }}>
        {matches.slice(0, PICKER_LIMIT).map((s) => (
          <ListGroup.Item
            key={s.doc.id}
            className="d-flex justify-content-between align-items-center"
          >
            <span>
              {s.title} <span className="text-muted">{s.composer}</span>
              {s.doc.projectId !== projectId && (
                <Badge bg="light" text="dark" className="ms-2">
                  {s.projectTitle}
                </Badge>
              )}
            </span>
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => void handleAdd(s)}
            >
              Adicionar
            </Button>
          </ListGroup.Item>
        ))}
      </ListGroup>
      {matches.length > PICKER_LIMIT && (
        <p className="text-muted small mt-1">
          Mostrando {PICKER_LIMIT} de {matches.length}. Filtre para ver as
          outras.
        </p>
      )}
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
