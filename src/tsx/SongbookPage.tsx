import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { PointerSensor } from "@dnd-kit/dom";
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
  getProjectSongbooks,
  getMemberRole,
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
import { groupScoreVersions, scoreSongbookSources } from "../lib/scorePicker";
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
import { SongBar } from "./PlayerBar";
import { AddButton } from "./AddButton";
import { DragHandle } from "./DragHandle";
import { ScoreCard } from "./ScoreCard";
import { substringRange } from "../lib/highlight";
import { SongBookTable } from "./SongBookTable";
import { SongbookGenerationPanel } from "./SongbookGenerationPanel";
import { SongbookDragProvider } from "./SongbookDragProvider";
import type { SongbookSortableListHandle } from "./SongbookSortableList";
import { SongbookReader } from "./SongbookReader";
import { buildSongbookSections } from "../lib/pdfGeneration";
import { generateSongbookPdfs } from "../lib/generateSongbookPdfs";

// The songbook's table, PDF generation and member tools live under ?detalhes;
// the reader is the landing view.
const DETAILS_PARAM = "detalhes";

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
  const [editing, setEditing] = useState<"contents" | null>(null);
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

  // Keeps ?versao= when switching between the reader and the details page.
  const withDetails = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    next.delete("musica");
    if (on) {
      next.set(DETAILS_PARAM, "");
    } else {
      next.delete(DETAILS_PARAM);
    }
    const query = next.toString().replace(/=(?=&|$)/g, "");
    return query ? `?${query}` : "?";
  };

  const badges = (
    <>
      {!songbook.isPublished && <Badge bg="secondary">não publicado</Badge>}
      {!isCurrent && <Badge bg="warning">versão antiga</Badge>}
    </>
  );

  if (!searchParams.has(DETAILS_PARAM)) {
    return (
      <SongbookReader
        title={songbook.title}
        badges={badges}
        items={items}
        actions={
          <Link to={withDetails(true)}>
            Detalhes, PDF e versões
          </Link>
        }
        onDownloadPdf={(instrument) =>
          generateSongbookPdfs({
            sections: buildSongbookSections(items),
            instruments: [instrument],
            title: songbook.title,
            covers: { [instrument]: revision.covers[instrument]?.url ?? "" },
            fallbackInstruments: new Set(),
            carnivalMode: false,
            backSheetPageNumber: false,
            antiAssedioPages: false,
          })
        }
      />
    );
  }

  return (
    <Container className="mt-4">
      <div className="d-flex align-items-baseline gap-2 mb-1">
        <h2 className="mb-0">{songbook.title}</h2>
        <span className="text-muted">versão #{revision.revisionNumber}</span>
        {badges}
      </div>
      <p className="text-muted">
        <Link to={withDetails(false)}>abrir caderninho</Link>
        {" · "}
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
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => setEditing("contents")}
                >
                  Editar
                </Button>
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
          <SongbookGenerationPanel
            songbook={songbook}
            revision={revision}
            items={items}
            canEditCovers={isCurrent && canEditSongbook(role)}
            onCoversSaved={() => setReloads((n) => n + 1)}
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

  const songbookRef = useRef<SongbookSortableListHandle>(null);

  const handleSelect = (score: ScoreViewModel, checked: boolean, index?: number) =>
    setItems((prev) => {
      if (!checked) {
        return prev.filter((r) => isSongbookSection(r) || r.score.id !== score.id);
      }
      const next = [...prev];
      next.splice(index ?? next.length, 0, songbookScore(score));
      return next;
    });

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
      <SongbookDragProvider
        songbookRef={songbookRef}
        onAddAt={(score, index) => handleSelect(score, true, index)}
        onRemove={(score) => handleSelect(score, false)}
      >
        <div className="row">
          <div className="col-sm-6">
            <h5>Partituras</h5>
            <ScorePicker
              projectId={projectId}
              selected={items}
              onAdd={(score) => handleSelect(score, true)}
              onPlay={setPlayingPart}
            />
          </div>
          <div className="col-sm-6">
            <h5>Caderninho</h5>
            <SongBookTable
              ref={songbookRef}
              rows={items}
              setItems={setItems}
              handleSelect={handleSelect}
              handleClear={() => setItems([])}
              onSetPlayingPart={setPlayingPart}
            />
          </div>
        </div>
      </SongbookDragProvider>
      <div className="row">
        <div className="col-sm-6" />
        <div className="col-sm-6">
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
  songbooks: string[];
}

// Enough to find a score by filtering; rendering every score would be slow.
const PICKER_LIMIT = 100;

/**
 * Linked scores are grouped per project, with the newest descendant first.
 */
function ScorePicker({
  projectId,
  selected,
  onAdd,
  onPlay,
}: {
  projectId: string;
  selected: SongbookItemViewModel[];
  onAdd: (score: ScoreViewModel) => void;
  onPlay: (info: PlayingPartViewModel) => void;
}) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [groups, setGroups] = useState<PickerScore[][] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setGroups(null);
    setError("");
    void (async () => {
      const [docs, projects] = await Promise.all([
        getAllScores(),
        getAllProjects(),
      ]);
      const books = (
        await Promise.all(projects.map(async (project) => {
          const role = uid ? await getMemberRole(project.id, uid) : undefined;
          return getProjectSongbooks(project.id, {
            publishedOnly: !isReviewer(role),
          });
        }))
      ).flat();
      const sources = scoreSongbookSources(
        await Promise.all(books.map(async (book) => ({
          book,
          revision: await getSongbookRevision(book.id, book.currentRevisionId),
        }))),
      );
      const titles = new Map(projects.map((p) => [p.id, p.title]));
      const live = docs.flatMap((doc): PickerScore[] => {
        const projectTitle = titles.get(doc.projectId);
        return projectTitle && !doc.deletedAt && doc.latestRevisionId
          ? [{
            doc,
            ...resolveScoreMetadata(doc),
            projectTitle,
            songbooks: sources.get(doc.id) ?? [],
          }]
          : [];
      });
      const own = (s: PickerScore) => (s.doc.projectId === projectId ? 0 : 1);
      const grouped = groupScoreVersions(live, docs).sort(
        (a, b) => own(a[0]) - own(b[0]) || a[0].title.localeCompare(b[0].title, "pt-BR"),
      );
      if (!cancelled) {
        setGroups(grouped);
      }
    })().catch(() => {
      if (!cancelled) {
        setError("Não foi possível carregar as músicas. Tente novamente.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, uid]);

  const selectedIds = useMemo(
    () =>
      new Set(
        selected.flatMap((i) => (isSongbookSection(i) ? [] : [i.score.id])),
      ),
    [selected],
  );

  const handleAdd = async ({ doc, projectTitle }: PickerScore) => {
    const revision = await getScoreRevision(doc.id, doc.latestRevisionId);
    if (!revision) {throw new Error("Score revision not found");}
    onAdd(toScoreViewModel(doc, revision, projectTitle));
  };

  // Drop zone for songbook cards dragged back out: removes them, regardless
  // of where in this list they're dropped.
  const { ref: dropRef } = useDroppable({
    id: "available-dropzone",
    data: { group: "available" },
    accept: (source) =>
      (source.data as { group?: string; itemType?: string }).group === "songbook" &&
      (source.data as { itemType?: string }).itemType === "score",
  });

  if (error) {return <Alert variant="danger">{error}</Alert>;}
  if (!groups) {return <Spinner animation="border" size="sm" />;}
  const needle = filter.trim().toLocaleLowerCase("pt-BR");
  const matches = groups.filter((versions) =>
    versions.some((s) => !selectedIds.has(s.doc.id)) &&
    versions.some((s) =>
      `${s.title} ${s.composer} ${s.projectTitle} ${s.songbooks.join(" ")}`
        .toLocaleLowerCase("pt-BR")
        .includes(needle),
    ),
  );

  return (
    <>
      <Form.Control
        className="mb-2"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por título, compositor, projeto ou caderninho"
      />
      <div ref={dropRef} className="score-card-list" style={{ maxHeight: 480, overflowY: "auto" }}>
        {matches.slice(0, PICKER_LIMIT).map((versions) => (
          <ScorePickerVersions
            key={versions[0].doc.id}
            versions={versions}
            selectedIds={selectedIds}
            needle={needle}
            onAdd={handleAdd}
            onPlay={onPlay}
          />
        ))}
      </div>
      {matches.length > PICKER_LIMIT && (
        <p className="text-muted small mt-1">
          Mostrando {PICKER_LIMIT} de {matches.length}. Filtre para ver as
          outras.
        </p>
      )}
    </>
  );
}

function ScorePickerVersions({ versions, selectedIds, needle, onAdd, onPlay }: {
  versions: PickerScore[];
  selectedIds: Set<string>;
  needle: string;
  onAdd: (score: PickerScore) => Promise<void>;
  onPlay: (info: PlayingPartViewModel) => void;
}) {
  const [chosenId, setChosenId] = useState(versions[0].doc.id);
  const [mode, setMode] = useState<"compact" | "expanded">("compact");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<ScoreViewModel | null>(null);
  const chosen = versions.find((s) => s.doc.id === chosenId) ?? versions[0];

  // Fetched lazily per row (not for the whole PICKER_LIMIT list at once) —
  // needed for ScoreCard's parts/midi/mscz, re-fetched when the chosen
  // version changes.
  useEffect(() => {
    let cancelled = false;
    setScore(null);
    void getScoreRevision(chosen.doc.id, chosen.doc.latestRevisionId).then(
      (revision) => {
        if (!cancelled && revision) {
          setScore(toScoreViewModel(chosen.doc, revision, chosen.projectTitle));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [chosen]);

  // Pointer-only: no stable order to preserve, so no keyboard drag affordance
  // here — keyboard users add via the "Adicionar" button instead.
  const { ref, handleRef } = useDraggable({
    id: `available:${chosen.doc.id}`,
    data: { group: "available", score: score ?? undefined },
    sensors: [PointerSensor],
    disabled: !score,
  });

  const add = async () => {
    setAdding(true);
    setError("");
    try {
      await onAdd(chosen);
    } catch {
      setError("Não foi possível adicionar a música. Tente novamente.");
    } finally {
      setAdding(false);
    }
  };

  if (!score) {
    return (
      <div className="text-muted p-2">
        <Spinner animation="border" size="sm" /> {chosen.title}
      </div>
    );
  }

  return (
    <div ref={ref}>
    <ScoreCard
      score={score}
      mode={mode}
      onToggleMode={() => setMode(mode === "compact" ? "expanded" : "compact")}
      onPlay={onPlay}
      highlight={{
        title: substringRange(score.title, needle),
        projectTitle: substringRange(score.projectTitle, needle),
        composer: substringRange(score.composer, needle),
      }}
      leading={<DragHandle label={`Arraste ${score.title} para o caderninho`} handleRef={handleRef} onPrepareDrag={() => undefined} />}
      trailing={
        <div className="score-card-trailing">
          <AddButton
            label={`Adicionar ${chosen.title}`}
            addedLabel={`${chosen.title} já adicionada`}
            disabled={adding}
            added={selectedIds.has(chosen.doc.id)}
            onClick={() => void add()}
          />
          {error && <div className="text-danger small">{error}</div>}
        </div>
      }
      details={
        <div className="score-card-versions">
          <div className="text-muted small mb-1">
            {chosen.songbooks.join(", ") || "Sem caderninho"}
          </div>
          {versions.length > 1 && (
            <Form.Select size="sm"
              aria-label={`Versão de ${versions[0].title} (${chosen.projectTitle})`}
              value={chosenId} onChange={(e) => setChosenId(e.target.value)}>
              {versions.map((s, index) => <option key={s.doc.id} value={s.doc.id}>
                {s.title} — {s.songbooks.join(", ") || "Sem caderninho"}
                {index === 0 ? " · mais recente" : ""}
                {selectedIds.has(s.doc.id) ? " · adicionada" : ""}
              </option>)}
            </Form.Select>
          )}
        </div>
      }
    />
    </div>
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
