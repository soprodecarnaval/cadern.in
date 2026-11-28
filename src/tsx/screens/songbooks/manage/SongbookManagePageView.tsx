import { Select } from "../../../atoms/Select";
import { Page } from "../../../atoms/Page";
import { List } from "../../../atoms/List";
import { Input } from "../../../atoms/Input";
import { Modal } from "../../../atoms/Modal";
import { Button } from "../../../atoms/Button";
import { CardPointerSensor } from "../../../../lib/cardPointerSensor";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { useEffect, useMemo, useState } from "react";
import { Alert, Form, Spinner, Table } from "react-bootstrap";
import { Badge } from "../../../atoms/Badge";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import type { WithId } from "../../../../lib/db";
import { projectPath, publicSongbookPath, scorePath, songbookEditPath, songbookScorePath } from "../../../../lib/routes";
import { Link as ButtonLink } from "../../../atoms/Link";
import {
  canDeleteSongbook,
  canEditSongbook,
  canPublishSongbook,
  canRepinSongbook,
  isReviewer,
} from "../../../../lib/roles";
import { groupScoreVersions, scoreSongbookSources } from "../../../../lib/scorePicker";
import {
  REMOVED_SCORES_NOTE,
  fromSongbookRevision,
  hasNewerVersion,
  isSongbookSection,
  repinnedContent,
  songbookScoreVersionLabel,
  toSongbookRevisionContent,
} from "../../../../lib/songbook";

import type {
  ScoreDoc,
  SongbookDoc,
  SongbookRevisionDoc,
} from "../../../../../types/docs";
import type {
  NumberedSongbookItemViewModel,
  NumberedSongbookScoreViewModel,
  ScoreViewModel,
  SongbookItemViewModel,
} from "../../../../../types/viewModels";
import { resolveScoreMetadata } from "../../../../lib/scoreMetadata";
import { toScoreViewModel } from "../../../../lib/viewModels";

import { AddButton } from "../../../components/scores/AddButton";
import { DragHandle } from "../../../components/songbooks/editor/DragHandle";

import { substringRange } from "../../../../lib/highlight";

import { SongbookDragProvider } from "../../../components/songbooks/editor/SongbookDragProvider";
import { ColumnDivider, type CollapsedSide } from "../../../components/songbooks/editor/ColumnDivider";
import "./SongbookEditColumns.css";
import { SearchField } from "../../builder/search/SearchField";
import { createCollectionSearch } from "../../../../lib/collectionSearch";
import { PaginationBar } from "../../../components/pagination/PaginationBar";
import { SortMenuButton } from "../../../components/songbooks/editor/toolbar/SortMenuButton";
import { parseSortValue } from "../../../components/scores/sortOptions";
import { FilterMenuButton } from "../../builder/search/FilterMenuButton";
import {
  filterCount,
  filterOptions,
  filterScores,
  NO_FILTERS,
  type ResultsFilters,
} from "../../builder/search/resultsFilter";
import { sortByColumn } from "../../../../utils/sort";
import { SongbookEditorList, SongbookEditorToolbar } from "../../../components/songbooks/editor/SongbookEditor";
import { useSongbookEditor } from "../../../components/songbooks/editor/useSongbookEditor";

import { buildSongbookSections } from "../../../../lib/pdfGeneration";
import { printOptions } from "../../../../lib/songbookPrint";
import { ProjectBreadcrumb } from "../../../components/navigation/ProjectBreadcrumb";
import {
  DuplicateSongbookButton,
  type DuplicateSongbookButtonServices,
} from "../../../components/songbooks/DuplicateSongbookButton";

// The songbook's table and member tools (Gerenciar) live under ?detalhes, its
// print settings in the editor (037); the reader is the landing view.
const DETAILS_PARAM = "detalhes";
const EDIT_PARAM = "editar";

interface Loaded {
  songbook: WithId<SongbookDoc>;
  revision: WithId<SongbookRevisionDoc>;
  items: NumberedSongbookItemViewModel[];
}

async function load(
  projectId: string,
  slug: string,
  revisionId: string | null,
  services: SongbookManagePageServices,
): Promise<Loaded | null> {
  const songbook = await services.getSongbook(projectId, slug);
  if (!songbook || songbook.deletedAt) {
    return null;
  }
  const revision = await services
    .getSongbookRevision(songbook.id, revisionId ?? songbook.currentRevisionId)
    .catch(() => null);
  if (!revision) {
    return null;
  }
  const items = fromSongbookRevision(
    revision,
    await services.loadPinnedScores(revision),
  );
  return { songbook, revision, items };
}

/**
 * Member workspace for a songbook: edit, re-pin, publish, delete, history —
 * the owning project's membership gates all of it, checked below before any
 * of this ever loads (008). The public reader lives in SongbookPageView.
 */
export type SongbookManagePageServices = {
  generateSongbookPdfs: typeof import("../../../../lib/generateSongbookPdfs").generateSongbookPdfs;
} & Pick<
  typeof import("../../../../lib/db"),
  | "createSongbookRevision"
  | "getAllProjects"
  | "getAllScores"
  | "getProjectScores"
  | "getProjectSongbooks"
  | "getMemberRole"
  | "getScoreRevision"
  | "getSongbook"
  | "getSongbookRevision"
  | "getSongbookRevisions"
  | "setSongbookPublished"
  | "softDeleteSongbook"
  | "swapSongbookEntryToFork"
> & {
    loadPinnedScores: typeof import("../../../../lib/songbookScores").loadPinnedScores;
  } & DuplicateSongbookButtonServices;

export function SongbookManagePageView({
  services,
  currentUser,
  role,
  components,
}: {
  services: SongbookManagePageServices;
  currentUser: import("firebase/auth").User | null;
  role: import("../../../../lib/roles").Role | "loading";
  components: {
    ScoreCard: typeof import("../../../components/scores/card/ScoreCard").ScoreCard;
    SongbookPrintSettingsDialog: typeof import("../../../components/songbooks/generation/SongbookPrintSettingsDialog").SongbookPrintSettingsDialog;
    SongbookReader: typeof import("../../../components/songbooks/reader/SongbookReader").SongbookReader;
  };
}) {
  const { slug: projectId, songbookSlug } = useParams<{
    slug: string;
    songbookSlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revisionParam = searchParams.get("versao");
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null | "loading">("loading");
  const [reloads, setReloads] = useState(0);
  const [forks, setForks] = useState<Map<string, string>>(new Map());
  // "Configurações de impressão" (037); each opening remounts the dialog.
  const [printSettingsOpens, setPrintSettingsOpens] = useState(0);
  const [printSettingsOpen, setPrintSettingsOpen] = useState(false);

  // Membership of the songbook's owning project, not just a role check in
  // the UI: a non-member never triggers the loads below (008).
  const isMember = role !== "loading" && isReviewer(role);

  useEffect(() => {
    if (!projectId || !songbookSlug || !isMember) {
      return;
    }
    setLoaded("loading");
    void load(projectId, songbookSlug, revisionParam, services).then(setLoaded);
  }, [projectId, songbookSlug, revisionParam, reloads, services, isMember]);

  // This project's forks, by the score they derive from.
  useEffect(() => {
    if (!projectId || !isMember) {
      setForks(new Map());
      return;
    }
    void services
      .getProjectScores(projectId)
      .then((scores) =>
        setForks(
          new Map(
            scores.flatMap((s) =>
              s.forkedFrom ? [[s.forkedFrom.scoreId, s.id] as const] : [],
            ),
          ),
        ),
      );
  }, [projectId, isMember, reloads, services]);

  if (role === "loading") {
    return (
      <Page className="mt-4">
        <Spinner animation="border" />
      </Page>
    );
  }

  if (!isMember) {
    return (
      <Page className="mt-4">
        <Alert variant="warning">
          Você não é membro deste projeto.{" "}
          {projectId && songbookSlug && (
            <Link to={publicSongbookPath(projectId, songbookSlug)}>
              Ver caderninho público
            </Link>
          )}
        </Alert>
      </Page>
    );
  }

  if (loaded === "loading") {
    return (
      <Page className="mt-4">
        <Spinner animation="border" />
      </Page>
    );
  }
  if (!loaded || !projectId) {
    return (
      <Page className="mt-4">
        <Alert variant="danger">Caderninho não encontrado.</Alert>
      </Page>
    );
  }

  const { songbook, revision, items } = loaded;
  const setEditing = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) {next.set(EDIT_PARAM, "");}
    else {next.delete(EDIT_PARAM);}
    setSearchParams(next, { replace: !on });
  };
  // A cover saved while editing makes a version of its own: reload without
  // the spinner, which would unmount the editor and drop unsaved changes.
  const refreshQuietly = () => {
    void load(projectId, songbook.slug, revisionParam, services).then(setLoaded);
  };
  const handleEditDone = (saved: boolean) => {
    setEditing(false);
    if (saved) {
      setReloads((n) => n + 1);
    }
  };
  const isCurrent = revision.id === songbook.currentRevisionId;
  const editing = isCurrent && canEditSongbook(role) && searchParams.has(EDIT_PARAM);
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
    await services.createSongbookRevision(songbook.id, content, {
      createdBy: currentUser.uid,
      note,
    });
    setReloads((n) => n + 1);
  };

  const handleSwap = async (scoreId: string, forkId: string) => {
    await services.swapSongbookEntryToFork(songbook.id, scoreId, forkId);
    setReloads((n) => n + 1);
  };

  const handleTogglePublished = async () => {
    await services.setSongbookPublished(songbook.id, !songbook.isPublished);
    setReloads((n) => n + 1);
  };

  // Keeps ?versao= when switching between the reader and the details page.
  const withDetails = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    next.delete("musica");
    next.delete(EDIT_PARAM);
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
      {!songbook.isPublished && <Badge variant="muted">não publicado</Badge>}
      {!isCurrent && <Badge variant="accent">versão antiga</Badge>}
    </>
  );

  if (!searchParams.has(DETAILS_PARAM)) {
    return (
      <components.SongbookReader
        title={songbook.title}
        projectId={songbook.projectId}
        badges={badges}
        items={items}
        actions={
          <div className="d-flex flex-column gap-2">
            <ProjectBreadcrumb
              signedIn={!!currentUser}
              project={{ id: songbook.projectId }}
              songbook={{ slug: songbook.slug, title: songbook.title, member: true }}
            />
            <Link to={withDetails(true)}>Gerenciar</Link>
          </div>
        }
        headActions={
          // Only for those who may edit the songbook, and on its current version.
          isCurrent && canEditSongbook(role) && (
            <ButtonLink to={songbookEditPath(songbook.projectId, songbook.slug)} size="sm" variant="secondary">
              Editar
            </ButtonLink>
          )
        }
        onDownloadPdf={(instrument) =>
          services.generateSongbookPdfs({
            sections: buildSongbookSections(items),
            instruments: [instrument],
            title: songbook.title,
            covers: { [instrument]: revision.covers[instrument]?.url ?? "" },
            carnivalMode: false,
            // The version's saved print settings (038).
            ...printOptions(revision),
          })
        }
      />
    );
  }

  return (
    <Page className="mt-4">
      <ProjectBreadcrumb
        signedIn={!!currentUser}
        project={{ id: songbook.projectId }}
        songbook={{ slug: songbook.slug, title: songbook.title, member: true }}
      />
      <div className="d-flex align-items-baseline gap-2 mb-1">
        <h2 className="mb-0">{songbook.title}</h2>
        <span className="text-muted">versão #{revision.revisionNumber}</span>
        {badges}
      </div>
      {editing ? (
        // In Editar the print settings take the links' place (037); the
        // breadcrumb still leads back.
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPrintSettingsOpens((n) => n + 1);
              setPrintSettingsOpen(true);
            }}
          >
            Configurações de impressão
          </Button>
          {revision.note && <span className="text-muted">{revision.note}</span>}
        </div>
      ) : (
        <p className="text-muted">
          <Link to={withDetails(false)}>abrir caderninho</Link>
          {" · "}
          <Link to={projectPath(projectId)}>caderninhos do projeto</Link>
          {revision.note && <> · {revision.note}</>}
        </p>
      )}

      {editing ? (
        <>
          <SongbookEditor
            services={services}
            currentUser={currentUser}
            components={components}
            projectId={projectId}
            songbook={songbook}
            initialItems={items}
            onDone={handleEditDone}
          />
          {/* Print settings (037): only in Editar, so only for those who can edit. */}
          <components.SongbookPrintSettingsDialog
            key={printSettingsOpens}
            show={printSettingsOpen}
            songbook={songbook}
            revision={revision}
            items={items}
            onSaved={refreshQuietly}
            onHide={() => setPrintSettingsOpen(false)}
          />
        </>
      ) : (
        <>
          {isCurrent && (
            // Duplicar, Editar, Publicar: each only for those allowed to.
            <div className="d-flex flex-wrap gap-2 mb-3">
              <DuplicateSongbookButton songbook={songbook} user={currentUser} services={services} />
              {canEditSongbook(role) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing(true)}
                >
                  Editar
                </Button>
              )}
              {canPublishSongbook(role) && (
                <Button
                  size="sm"
                  variant={
                    songbook.isPublished ? "secondary" : "primary"
                  }
                  onClick={() => void handleTogglePublished()}
                >
                  {songbook.isPublished ? "Despublicar" : "Publicar"}
                </Button>
              )}
              {canRepin && stale.length > 0 && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void handleRepin(stale.map((i) => i.score.id))}
                >
                  Atualizar todas ({stale.length})
                </Button>
              )}
            </div>
          )}
          <SongbookContents
            projectId={songbook.projectId}
            songbookSlug={songbook.slug}
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
          {isReviewer(role) && (
            <SongbookHistory
              services={services}
              songbookId={songbook.id}
              currentRevisionId={songbook.currentRevisionId}
              shownRevisionId={revision.id}
            />
          )}
          {canDeleteSongbook(role) && (
            <DeleteSongbookSection
              services={services}
              songbook={songbook}
              onDeleted={() => void navigate(projectPath(projectId))}
            />
          )}
        </>
      )}
    </Page>
  );
}

/** Owner-only; asks for the title. The songbook's scores are untouched. */
function DeleteSongbookSection({
  services,

  songbook,
  onDeleted,
}: {
  services: SongbookManagePageServices;

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
      await services.softDeleteSongbook(songbook.id);
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
        <Form.Control as={Input}
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
  projectId,
  songbookSlug,
  items,
  showNewerVersions,
  onRepin,
  forks,
  onSwap,
}: {
  projectId: string;
  songbookSlug: string;
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
                    <Link
                      to={songbookScorePath(
                        projectId,
                        songbookSlug,
                        item.score.id,
                      )}
                    >
                      {item.score.title}
                    </Link>
                  )}
                  <div className="text-muted small text-break">
                    {songbookScoreVersionLabel(item, projectId)}
                  </div>
                </td>
                <td className="text-muted">{item.score.composer}</td>
                <td className="text-end">
                  {!item.deleted && forks.has(item.score.id) && (
                    <>
                      <Link
                        to={scorePath(forks.get(item.score.id)!)}
                      >
                        <Badge variant="accent">
                          derivação disponível
                        </Badge>
                      </Link>
                      {onSwap && (
                        <Button
                          size="sm"
                          variant="text"
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
                      <Link to={scorePath(item.score.id)}>
                        <Badge variant="accent">
                          nova versão
                        </Badge>
                      </Link>
                      {onRepin && (
                        <Button
                          size="sm"
                          variant="text"
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
  services,
  currentUser,
  components,

  projectId,
  songbook,
  initialItems,
  onDone,
}: {
  services: SongbookManagePageServices;
  currentUser: import("firebase/auth").User | null;
  components: {
    ScoreCard: typeof import("../../../components/scores/card/ScoreCard").ScoreCard;
    SongbookPrintSettingsDialog: typeof import("../../../components/songbooks/generation/SongbookPrintSettingsDialog").SongbookPrintSettingsDialog;
    SongbookReader: typeof import("../../../components/songbooks/reader/SongbookReader").SongbookReader;
  };

  projectId: string;
  songbook: WithId<SongbookDoc>;
  initialItems: SongbookItemViewModel[];
  onDone: (saved: boolean) => void;
}) {
  // Montar's Caderninho editor.
  const editor = useSongbookEditor(initialItems);
  const { items } = editor;
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Partituras (left) or Caderninho (right) hidden by the column divider.
  const [collapsed, setCollapsed] = useState<CollapsedSide>(null);
  // The toolbar's save button opens "Salvar versão", with its note.
  const [showSave, setShowSave] = useState(false);
  // Montar's search, over the scores Partituras offers.
  const [query, setQuery] = useState("");

  const handleSave = async () => {
    if (!currentUser) {
      return;
    }
    setPending(true);
    setError("");
    try {
      // Covers belong to each version: carry over the current one's. Read
      // fresh, since saving a cover on this page makes a version of its own.
      const latest = await services.getSongbook(songbook.projectId, songbook.slug);
      const current = latest && await services.getSongbookRevision(
        songbook.id,
        latest.currentRevisionId,
      );
      if (!current) {
        // Saving without them would drop the covers.
        throw new Error("Não foi possível ler a versão atual. Tente novamente.");
      }
      await services.createSongbookRevision(
        songbook.id,
        toSongbookRevisionContent(items, current.covers),
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
      <SongbookDragProvider
        songbookRef={editor.listRef}
        onAddAt={editor.add}
        onRemove={editor.remove}
      >
        <div
          className={
            collapsed
              ? `songbook-edit-columns is-${collapsed}-collapsed`
              : "songbook-edit-columns"
          }
        >
          {/* As on Montar: the search box and the toolbar share the top row,
              Partituras and the Caderninho the one below. */}
          <div className="songbook-edit-cell songbook-edit-search">
            <SearchField value={query} onChange={setQuery} />
          </div>
          <div className="songbook-edit-cell songbook-edit-toolbar">
            <SongbookEditorToolbar
              editor={editor}
              saveLabel="Salvar versão"
              canSave
              onSave={() => setShowSave(true)}
            />
          </div>
          <div className="songbook-edit-cell songbook-edit-picker">
            <ScorePicker
              services={services}
              currentUser={currentUser}
              components={components}
              projectId={projectId}
              selected={items}
              query={query}
              onAdd={(score) => editor.add(score)}
            />
          </div>
          <ColumnDivider
            collapsed={collapsed}
            onChange={setCollapsed}
            leftLabel="Partituras"
            rightLabel="Caderninho"
          />
          <div className="songbook-edit-cell songbook-edit-songbook">
            <SongbookEditorList
              editor={editor}
              Card={components.ScoreCard}
              countAction={
                // Leaves editing without saving.
                <Button variant="secondary" onClick={() => onDone(false)}>
                  Cancelar
                </Button>
              }
            />
          </div>
        </div>
      </SongbookDragProvider>
      <Modal
        show={showSave}
        onHide={() => { if (!pending) { setShowSave(false); } }}
        aria-labelledby="songbook-save-version-title"
        centered
      >
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title id="songbook-save-version-title">Salvar versão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control as={Input}
            aria-label="O que mudou nesta versão? (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que mudou nesta versão? (opcional)"
            autoFocus
          />
          {error && <div className="text-danger mt-2" role="alert">{error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={pending} onClick={() => setShowSave(false)}>
            Cancelar
          </Button>
          <Button disabled={pending} onClick={() => void handleSave()}>
            {pending ? <Spinner animation="border" size="sm" /> : "Salvar versão"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

interface PickerScore {
  doc: WithId<ScoreDoc>;
  title: string;
  composer: string;
  tags: string[];
  projectTitle: string;
  songbooks: string[];
}

// Scores per page, as Montar's Resultados.
const PICKER_PAGE_SIZE = 10;

/**
 * Linked scores are grouped per project, with the newest descendant first.
 */
function ScorePicker({
  services,
  currentUser,
  components,

  projectId,
  selected,
  query,
  onAdd,
}: {
  services: SongbookManagePageServices;
  currentUser: import("firebase/auth").User | null;
  components: {
    ScoreCard: typeof import("../../../components/scores/card/ScoreCard").ScoreCard;
    SongbookPrintSettingsDialog: typeof import("../../../components/songbooks/generation/SongbookPrintSettingsDialog").SongbookPrintSettingsDialog;
    SongbookReader: typeof import("../../../components/songbooks/reader/SongbookReader").SongbookReader;
  };

  projectId: string;
  selected: SongbookItemViewModel[];
  /** What the search box above holds. */
  query: string;
  onAdd: (score: ScoreViewModel) => void;
}) {
  const uid = currentUser?.uid;
  const [groups, setGroups] = useState<PickerScore[][] | null>(null);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // A new search starts on the first page.
  useEffect(() => setCurrentPage(1), [query]);
  // Montar's search over every version, also matching songbook names.
  const versionSearch = useMemo(() => {
    const versions = (groups ?? []).flatMap((versions, group) =>
      versions.map((version) => ({ ...version, group })));
    return createCollectionSearch(versions, ["songbooks"]);
  }, [groups]);
  // Montar's "Filtrar" and "Ordenar por", beside the pages.
  const [filters, setFilters] = useState<ResultsFilters>(NO_FILTERS);
  const [sortValue, setSortValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    setGroups(null);
    setError("");
    void (async () => {
      const [docs, projects] = await Promise.all([
        services.getAllScores(),
        services.getAllProjects(),
      ]);
      const books = (
        await Promise.all(
          projects.map(async (project) => {
            const role = uid
              ? await services.getMemberRole(project.id, uid)
              : undefined;
            return services.getProjectSongbooks(project.id, {
              publishedOnly: !isReviewer(role),
            });
          }),
        )
      ).flat();
      const sources = scoreSongbookSources(
        await Promise.all(
          books.map(async (book) => ({
            book,
            revision: await services.getSongbookRevision(
              book.id,
              book.currentRevisionId,
            ),
          })),
        ),
      );
      const titles = new Map(projects.map((p) => [p.id, p.title]));
      const live = docs.flatMap((doc): PickerScore[] => {
        const projectTitle = titles.get(doc.projectId);
        return projectTitle && !doc.deletedAt && doc.latestRevisionId
          ? [
              {
                doc,
                ...resolveScoreMetadata(doc),
                projectTitle,
                songbooks: sources.get(doc.id) ?? [],
              },
            ]
          : [];
      });
      const own = (s: PickerScore) => (s.doc.projectId === projectId ? 0 : 1);
      const grouped = groupScoreVersions(live, docs).sort(
        (a, b) =>
          own(a[0]) - own(b[0]) ||
          a[0].title.localeCompare(b[0].title, "pt-BR"),
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
  }, [projectId, uid, services]);

  const selectedIds = useMemo(
    () =>
      new Set(
        selected.flatMap((i) => (isSongbookSection(i) ? [] : [i.score.id])),
      ),
    [selected],
  );

  const handleAdd = async ({ doc, projectTitle }: PickerScore) => {
    const revision = await services.getScoreRevision(
      doc.id,
      doc.latestRevisionId,
    );
    if (!revision) {
      throw new Error("Score revision not found");
    }
    onAdd(toScoreViewModel(doc, revision, projectTitle));
  };

  // Drop zone for songbook cards dragged back out: removes them, regardless
  // of where in this list they're dropped.
  const { ref: dropRef } = useDroppable({
    id: "available-dropzone",
    data: { group: "available" },
    accept: (source) =>
      (source.data as { group?: string; itemType?: string }).group ===
        "songbook" &&
      (source.data as { itemType?: string }).itemType === "score",
  });

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (!groups) {
    return <Spinner animation="border" size="sm" />;
  }
  // For highlighting: the words searched, without Montar's exact-search marks.
  const needle = query.replace(/["^']/g, "").trim().toLocaleLowerCase("pt-BR");
  // The groups with a matching version, best match first (as listed when
  // nothing is searched), leaving out those already all in the songbook.
  const matchedGroups = [...new Set(versionSearch.search(query.trim()).map((s) => s.group))];
  const matches = matchedGroups
    .map((group) => groups[group])
    .filter((versions) => versions.some((s) => !selectedIds.has(s.doc.id)));
  // Filtered and sorted by each group's newest version, as it is shown.
  const rows = matches.map((versions) => ({ ...versions[0], versions }));
  const filterChoices = filterOptions(rows);
  const filtered = filterScores(rows, filters);
  const shown = (sortValue ? sortByColumn(filtered, ...parseSortValue(sortValue)) : filtered)
    .map((row) => row.versions);
  const filtering = filterCount(filters) > 0;
  const maxNumberPages = Math.max(1, Math.ceil(shown.length / PICKER_PAGE_SIZE));
  const page = Math.min(currentPage, maxNumberPages);
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(Number.isFinite(pageNumber) ? Math.max(1, Math.min(pageNumber, maxNumberPages)) : 1);
  };

  return (
    <>
      {/* As Montar's "Resultados". */}
      <h3 className="results songbook-editor-title">Partituras</h3>
      <div ref={dropRef} className="score-card-list">
        {shown.slice((page - 1) * PICKER_PAGE_SIZE, page * PICKER_PAGE_SIZE).map((versions) => (
          <ScorePickerVersions
            services={services}
            components={components}
            key={versions[0].doc.id}
            versions={versions}
            selectedIds={selectedIds}
            needle={needle}
            onAdd={handleAdd}
          />
        ))}
        {shown.length === 0 && filtering && (
          <p className="text-muted m-0">Nenhuma música com esses filtros.</p>
        )}
      </div>
      {/* As Montar's Resultados: the pages, only when the scores need more
          than one, and "Filtrar" and "Ordenar por" at the right. */}
      <div className="d-flex align-items-center justify-content-between" style={{ marginTop: "15px" }}>
        {maxNumberPages > 1 && (
          <PaginationBar onChange={handlePageChange} currentPage={page} maxNumberPages={maxNumberPages} />
        )}
        <div className="d-flex gap-2 ms-auto">
          <FilterMenuButton
            options={filterChoices}
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setCurrentPage(1);
            }}
          />
          <SortMenuButton small value={sortValue} onSort={(value) => {
            setSortValue(value);
            setCurrentPage(1);
          }} />
        </div>
      </div>
    </>
  );
}

function ScorePickerVersions({
  services,
  components,
  versions,
  selectedIds,
  needle,
  onAdd,
}: {
  services: SongbookManagePageServices;
  components: {
    ScoreCard: typeof import("../../../components/scores/card/ScoreCard").ScoreCard;
    SongbookPrintSettingsDialog: typeof import("../../../components/songbooks/generation/SongbookPrintSettingsDialog").SongbookPrintSettingsDialog;
    SongbookReader: typeof import("../../../components/songbooks/reader/SongbookReader").SongbookReader;
  };

  versions: PickerScore[];
  selectedIds: Set<string>;
  needle: string;
  onAdd: (score: PickerScore) => Promise<void>;
}) {
  const [chosenId, setChosenId] = useState(versions[0].doc.id);
  const [mode, setMode] = useState<"compact" | "expanded">("compact");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<ScoreViewModel | null>(null);
  const chosen = versions.find((s) => s.doc.id === chosenId) ?? versions[0];

  // Fetched lazily per row (only for the page shown) —
  // needed for ScoreCard's parts/midi/mscz, re-fetched when the chosen
  // version changes.
  useEffect(() => {
    let cancelled = false;
    setScore(null);
    void services
      .getScoreRevision(chosen.doc.id, chosen.doc.latestRevisionId)
      .then((revision) => {
        if (!cancelled && revision) {
          setScore(toScoreViewModel(chosen.doc, revision, chosen.projectTitle));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chosen, services]);

  // Pointer-only: no stable order to preserve, so no keyboard drag affordance
  // here — keyboard users add via the "Adicionar" button instead.
  const { ref, handleRef } = useDraggable({
    id: `available:${chosen.doc.id}`,
    data: { group: "available", score: score ?? undefined },
    sensors: [CardPointerSensor],
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
      <components.ScoreCard
        score={score}
        mode={mode}
        onToggleMode={() =>
          setMode(mode === "compact" ? "expanded" : "compact")
        }
        highlight={{
          title: substringRange(score.title, needle),
          projectTitle: substringRange(score.projectTitle, needle),
          composer: substringRange(score.composer, needle),
        }}
        leading={
          <DragHandle
            label={`Arraste ${score.title} para o caderninho`}
            handleRef={handleRef}
            onPrepareDrag={() => undefined}
          />
        }
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
              <Select
                size="sm"
                aria-label={`Versão de ${versions[0].title} (${chosen.projectTitle})`}
                value={chosenId}
                onChange={(e) => setChosenId(e.target.value)}
              >
                {versions.map((s, index) => (
                  <option key={s.doc.id} value={s.doc.id}>
                    {s.title} — {s.songbooks.join(", ") || "Sem caderninho"}
                    {index === 0 ? " · mais recente" : ""}
                    {selectedIds.has(s.doc.id) ? " · adicionada" : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>
        }
      />
    </div>
  );
}

function SongbookHistory({
  services,

  songbookId,
  currentRevisionId,
  shownRevisionId,
}: {
  services: SongbookManagePageServices;

  songbookId: string;
  currentRevisionId: string;
  shownRevisionId: string;
}) {
  const [revisions, setRevisions] = useState<
    WithId<SongbookRevisionDoc>[] | null
  >(null);

  useEffect(() => {
    void services.getSongbookRevisions(songbookId).then(setRevisions);
  }, [songbookId, currentRevisionId, services]);

  if (!revisions) {
    return null;
  }
  return (
    <section className="mt-4">
      <h5>Histórico</h5>
      <List>
        {revisions.map((rev) => (
          <List.Item
            key={rev.id}
            action
            as={Link}
            to={
              rev.id === currentRevisionId
                ? "?"
                : `?versao=${encodeURIComponent(rev.id)}`
            }
            active={rev.id === shownRevisionId}
            aria-current={rev.id === shownRevisionId ? "page" : undefined}
          >
            Versão #{rev.revisionNumber} ·{" "}
            {rev.createdAt?.toDate().toLocaleDateString("pt-BR") ?? "—"}
            {rev.note && <> · {rev.note}</>}
          </List.Item>
        ))}
      </List>
    </section>
  );
}
