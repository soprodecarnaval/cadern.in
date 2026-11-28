import { Button } from "../../../atoms/Button";
import { Page } from "../../../atoms/Page";
import { Link } from "../../../atoms/Link";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "react-bootstrap";
import { Badge } from "../../../atoms/Badge";
import { BsEye, BsEyeSlash, BsGear, BsPencil, BsPrinter } from "react-icons/bs";
import { Link as RouterLink, useParams } from "react-router-dom";
import type { WithId } from "../../../../lib/db";
import { canEditSongbook, canPublishSongbook, isAdmin, isEditor, isReviewer } from "../../../../lib/roles";
import {
  projectSettingsPath,
  publicSongbookPath,
  scorePath,
  songbookDetailsPath,
  songbookEditPath,
  songbookPath,
} from "../../../../lib/routes";
import { buildExportDeepLink } from "../../../../../types/exportDeepLink";
import { BROWSER_UPLOAD_MODE, FEATURE_FLAG_BROWSER_UPLOAD } from "../../../../featureFlags";
import { uploadPath } from "../../../../lib/uploadPath";

import type {
  ProjectDoc,
  ScoreDoc,
  SongbookDoc,
  UserProjectRole,
} from "../../../../../types/docs";
import { SongbookPrintDialog, type SongbookPrintServices } from "./SongbookPrintDialog";
import { CreateSongbookForm } from "./CreateSongbookForm";
import { resolveScoreMetadata } from "../../../../lib/scoreMetadata";
import { ProjectBreadcrumb } from "../../../components/navigation/ProjectBreadcrumb";
import { DuplicateSongbookButton, type DuplicateSongbookButtonServices } from "../../../components/songbooks/DuplicateSongbookButton";
import "../../../components/scores/card/ScoreRow.css";
import "./PublicProjectPage.css";

const ROLE_LABELS: Record<UserProjectRole, string> = {
  owner: "Dono",
  admin: "Admin",
  editor: "Editor",
  reviewer: "Revisor",
};

export type PublicProjectPageServices = Pick<
  typeof import("../../../../lib/db"),
  | "getProjectBySlug"
  | "getProjectScores"
  | "getProjectSongbooks"
  | "createSongbook"
  | "getSongbook"
  | "setSongbookPublished"
> & SongbookPrintServices & DuplicateSongbookButtonServices;

export function PublicProjectPageView({
  services,
  role,
  currentUser,
}: {
  services: PublicProjectPageServices;
  currentUser: import("firebase/auth").User | null;
  role: import("../../../../lib/roles").Role | "loading";
}) {
  const { slug } = useParams<{ slug: string }>();

  const [project, setProject] = useState<WithId<ProjectDoc> | null | "loading">(
    "loading",
  );
  const [scores, setScores] = useState<WithId<ScoreDoc>[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);
  const [songbooks, setSongbooks] = useState<WithId<SongbookDoc>[] | null>(null);
  const [publishing, setPublishing] = useState<ReadonlySet<string>>(new Set());
  const [publishError, setPublishError] = useState<string | null>(null);
  const [printBook, setPrintBook] = useState<WithId<SongbookDoc> | null>(null);
  const [creating, setCreating] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const [songbooksError, setSongbooksError] = useState(false);
  const [scoresError, setScoresError] = useState(false);
  const [projectAttempt, retryProject] = useState(0);
  const [songbooksAttempt, retrySongbooks] = useState(0);
  const [scoresAttempt, retryScores] = useState(0);
  const isMember = role !== "loading" && isReviewer(role);

  useEffect(() => {
    let active = true;
    setProject("loading");
    setProjectError(false);
    if (slug) {
      void services.getProjectBySlug(slug).then(
        (value) => {
          if (active) { setProject(value); }
        },
        () => {
          if (active) { setProjectError(true); }
        },
      );
    }
    return () => {
      active = false;
    };
  }, [slug, services, projectAttempt]);

  useEffect(() => {
    let active = true;
    setSongbooks(null);
    setSongbooksError(false);
    if (
      slug && project && project !== "loading" &&
      !project.deletedAt && role !== "loading"
    ) {
      void services.getProjectSongbooks(slug, { publishedOnly: !isMember }).then(
        (value) => {
          if (active) { setSongbooks(value); }
        },
        () => {
          if (active) { setSongbooksError(true); }
        },
      );
    }
    return () => {
      active = false;
    };
  }, [slug, project, role, isMember, services, songbooksAttempt]);

  useEffect(() => {
    let active = true;
    setScores([]);
    setScoresLoading(true);
    setScoresError(false);
    if (slug && project && project !== "loading" && !project.deletedAt && isMember) {
      void services.getProjectScores(slug).then(
        (value) => {
          if (active) {
            setScores(value);
            setScoresLoading(false);
          }
        },
        () => {
          if (active) { setScoresError(true); }
        },
      );
    }
    return () => {
      active = false;
    };
  }, [slug, project, isMember, services, scoresAttempt]);

  if (projectError) {
    return (
      <Page className="mt-4">
        <Alert variant="danger">
          Não foi possível carregar o projeto.{" "}
          <Button variant="danger-secondary" onClick={() => retryProject((n) => n + 1)}>
            Tentar novamente
          </Button>
        </Alert>
      </Page>
    );
  }

  if (project === "loading") {
    return (
      <Page className="mt-4">
        <Spinner animation="border" />
      </Page>
    );
  }

  if (!project || project.deletedAt) {
    return (
      <Page className="mt-4">
        <Alert variant="danger">Projeto não encontrado.</Alert>
      </Page>
    );
  }

  const myRole = role === "loading" ? undefined : role;
  const canManage = isAdmin(myRole);
  const canUpload = isEditor(myRole);

  const setPublished = async (id: string, isPublished: boolean) => {
    if (publishing.has(id)) {return;}
    setPublishing((current) => new Set(current).add(id));
    setPublishError(null);
    try {
      await services.setSongbookPublished(id, isPublished);
      setSongbooks((current) => current?.map((book) => book.id === id ? { ...book, isPublished } : book) ?? null);
    } catch {
      setPublishError(id);
    } finally {
      setPublishing((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const uploadActions = canUpload && (
    <div className="d-flex flex-wrap gap-2">
      {FEATURE_FLAG_BROWSER_UPLOAD && (
        <Link to={uploadPath({ projectId: project.id })} size="sm" variant="primary">
          Enviar partitura
        </Link>
      )}
      {BROWSER_UPLOAD_MODE !== "default" && (
        <a className="btn btn-outline-secondary ds-button btn-sm project-upload-musescore" href={buildExportDeepLink({ projectId: project.id })}>
          Enviar pelo MuseScore
        </a>
      )}
    </div>
  );

  return (
    <Page className="mt-4">
      <ProjectBreadcrumb signedIn={!!currentUser} project={{ id: project.id, title: project.title }} />
      <div className="d-flex justify-content-between align-items-start mb-1 gap-2">
        <div className="d-flex gap-2 align-items-center">
          <h2 className="mb-0">{project.title}</h2>
          {myRole && (
            <Badge variant="strong">
              {ROLE_LABELS[myRole]}
            </Badge>
          )}
        </div>
        {canManage && (
          <Link to={projectSettingsPath(slug ?? "")} size="sm" variant="secondary">
            Configurações
          </Link>
        )}
      </div>
      <p className="text-muted mb-4">
        <small>/{project.slug}</small>
      </p>

      <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
        <h5 className="mb-0">Caderninhos</h5>
        {canManage && currentUser && !creating && songbooks !== null && (
          <Button size="sm" className="project-new-songbook" onClick={() => setCreating(true)}>
            Novo caderninho
          </Button>
        )}
      </div>
      {canManage && currentUser && creating && (
        <CreateSongbookForm
          key={project.id}
          services={services}
          currentUser={currentUser}
          projectId={project.id}
          onCancel={() => setCreating(false)}
        />
      )}
      {songbooksError ? (
        <Alert variant="danger">Não foi possível carregar os caderninhos.{" "}
          <Button variant="danger-secondary" onClick={() => retrySongbooks((n) => n + 1)}>Tentar novamente</Button>
        </Alert>
      ) : songbooks === null ? (
        <Spinner animation="border" />
      ) : songbooks.length === 0 ? (
        <Alert variant="info" className="project-empty mb-5">
          {isMember
            ? "Nenhum caderninho ainda."
            : "Nenhum caderninho publicado."}
        </Alert>
      ) : (
        // Each songbook as a song card's tag (ScoreRow.css): bordered, round
        // corners, its title at the left and its actions at the right.
        <div className="score-card-list project-songbooks mb-5">
          {songbooks.map((sb) => (
            <div key={sb.id} className="score-card">
              <div className="score-card-row project-songbook-row">
                <RouterLink
                  className="score-card-main score-card-title"
                  to={
                    isMember
                      ? songbookPath(project.id, sb.slug)
                      : publicSongbookPath(project.id, sb.slug)
                  }
                >
                  {sb.title}
                </RouterLink>
                <div className="project-songbook-actions d-flex flex-wrap align-items-center justify-content-end gap-2">
                  {/* Icon buttons (036): each label is the accessible name and the tooltip. */}
                  <Button size="sm" variant="secondary" className="project-icon-button" onClick={() => setPrintBook(sb)}
                    aria-label={`Imprimir ${sb.title}`} title={`Imprimir ${sb.title}`}>
                    <BsPrinter aria-hidden />
                  </Button>
                  {canEditSongbook(myRole) && (
                    <Link to={songbookEditPath(project.id, sb.slug)} size="sm" variant="secondary" className="project-icon-button"
                      aria-label={`Editar ${sb.title}`} title={`Editar ${sb.title}`}>
                      <BsPencil aria-hidden />
                    </Link>
                  )}
                  {isMember && (
                    <Link to={songbookDetailsPath(project.id, sb.slug)} size="sm" variant="secondary" className="project-icon-button"
                      aria-label={`Gerenciar ${sb.title}`} title={`Gerenciar ${sb.title}`}>
                      <BsGear aria-hidden />
                    </Link>
                  )}
                  <DuplicateSongbookButton songbook={sb} user={currentUser} services={services} iconOnly className="project-icon-button" />
                  {canPublishSongbook(myRole) && (
                    // Unpublished: yellow "Publicar" (eye); published: white "Despublicar" (crossed eye).
                    <Button size="sm" variant={sb.isPublished ? "secondary" : "primary"} className="project-icon-button"
                      disabled={publishing.has(sb.id)} onClick={() => void setPublished(sb.id, !sb.isPublished)}
                      aria-label={`${sb.isPublished ? "Despublicar" : "Publicar"} ${sb.title}`}
                      title={`${sb.isPublished ? "Despublicar" : "Publicar"} ${sb.title}`}>
                      {publishing.has(sb.id)
                        ? <Spinner animation="border" size="sm" aria-hidden />
                        : sb.isPublished ? <BsEyeSlash aria-hidden /> : <BsEye aria-hidden />}
                    </Button>
                  )}
                </div>
              </div>
              {publishError === sb.id && (
                <div role="alert" className="text-danger project-songbook-error">
                  {sb.isPublished ? "Não foi possível despublicar." : "Não foi possível publicar."}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {printBook && <SongbookPrintDialog key={printBook.id} songbook={printBook} services={services} onHide={() => setPrintBook(null)} />}
      {isMember && (
        <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
          <h5 className="mb-0">Partituras</h5>
          {(scoresLoading || scoresError || scores.length > 0) && uploadActions}
        </div>
      )}
      {!isMember ? null : scoresError ? (
        <Alert variant="danger">Não foi possível carregar as partituras.{" "}
          <Button variant="danger-secondary" onClick={() => retryScores((n) => n + 1)}>Tentar novamente</Button>
        </Alert>
      ) : scoresLoading ? (
        <Spinner animation="border" />
      ) : scores.length === 0 ? (
        <Alert variant="info" className="project-empty d-flex flex-wrap align-items-center justify-content-between gap-2">
          Nenhuma partitura neste projeto.
          {uploadActions}
        </Alert>
      ) : (
        // Each score as a tag, as the songbooks above: its title and
        // composer at the left, "Ver" at the right.
        <div className="score-card-list project-scores">
          {scores.map((score) => {
            const { title, composer } = resolveScoreMetadata(score);
            return (
              <div key={score.id} className="score-card">
                <div className="score-card-row project-songbook-row">
                  <div className="score-card-main">
                    <div className="score-card-title">{title}</div>
                    {composer && <div className="score-card-meta text-muted small">{composer}</div>}
                  </div>
                  <Link to={scorePath(score.id)} size="sm" variant="secondary" aria-label={`Ver ${title}`}>
                    Ver
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
