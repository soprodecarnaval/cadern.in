import { Button } from "../../../atoms/Button";
import { Page } from "../../../atoms/Page";
import { Link } from "../../../atoms/Link";
import { useEffect, useState } from "react";
import { Alert, Spinner, Table } from "react-bootstrap";
import { Badge } from "../../../atoms/Badge";
import { Link as RouterLink, useParams } from "react-router-dom";
import type { WithId } from "../../../../lib/db";
import { canEditSongbook, canPublishSongbook, isAdmin, isEditor, isReviewer } from "../../../../lib/roles";
import {
  projectSettingsPath,
  publicSongbookPath,
  scorePath,
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
> & SongbookPrintServices;

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

  const publish = async (id: string) => {
    if (publishing.has(id)) {return;}
    setPublishing((current) => new Set(current).add(id));
    setPublishError(null);
    try {
      await services.setSongbookPublished(id, true);
      setSongbooks((current) => current?.map((book) => book.id === id ? { ...book, isPublished: true } : book) ?? null);
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

  return (
    <Page className="mt-4">
      <div className="d-flex justify-content-between align-items-start mb-1 gap-2 flex-wrap">
        <div className="d-flex flex-wrap gap-2 align-items-center">
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
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            + Novo caderninho
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
        <Alert variant="info">
          {isMember
            ? "Nenhum caderninho ainda."
            : "Nenhum caderninho publicado."}
        </Alert>
      ) : (
        <Table hover className="mb-4">
          <tbody>
            {songbooks.map((sb) => (
              <tr key={sb.id}>
                <td>
                  <RouterLink
                    to={
                      isMember
                        ? songbookPath(project.id, sb.slug)
                        : publicSongbookPath(project.id, sb.slug)
                    }
                  >
                    {sb.title}
                  </RouterLink>
                </td>
                <td className="text-end">
                  <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
                    {!sb.isPublished && <small className="text-muted">não publicado</small>}
                    <Button size="sm" variant="secondary" onClick={() => setPrintBook(sb)} aria-label={`Imprimir ${sb.title}`}>
                      Imprimir
                    </Button>
                    {canEditSongbook(myRole) && (
                      <Link to={songbookEditPath(project.id, sb.slug)} size="sm" variant="secondary" aria-label={`Editar ${sb.title}`}>
                        Editar
                      </Link>
                    )}
                    {!sb.isPublished && canPublishSongbook(myRole) && (
                      <Button size="sm" disabled={publishing.has(sb.id)} onClick={() => void publish(sb.id)} aria-label={`Publicar ${sb.title}`}>
                        {publishing.has(sb.id) ? "Publicando…" : "Publicar"}
                      </Button>
                    )}
                  </div>
                  {publishError === sb.id && <div role="alert" className="text-danger">Não foi possível publicar este caderninho.</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {printBook && <SongbookPrintDialog key={printBook.id} songbook={printBook} services={services} onHide={() => setPrintBook(null)} />}
      {isMember && (
        <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
          <h5 className="mb-0">Partituras</h5>
          {canUpload && (
            <div className="d-flex flex-wrap gap-2">
              {FEATURE_FLAG_BROWSER_UPLOAD && (
                <RouterLink className="btn btn-outline-secondary ds-button btn-sm" to={uploadPath({ projectId: project.id })}>
                  Enviar partitura pelo navegador
                </RouterLink>
              )}
              {BROWSER_UPLOAD_MODE !== "default" && (
                <a className="btn btn-outline-secondary ds-button btn-sm" href={buildExportDeepLink({ projectId: project.id })}>
                  Enviar partitura pelo MuseScore
                </a>
              )}
            </div>
          )}
        </div>
      )}
      {!isMember ? null : scoresError ? (
        <Alert variant="danger">Não foi possível carregar as partituras.{" "}
          <Button variant="danger-secondary" onClick={() => retryScores((n) => n + 1)}>Tentar novamente</Button>
        </Alert>
      ) : scoresLoading ? (
        <Spinner animation="border" />
      ) : scores.length === 0 ? (
        <Alert variant="info">Nenhuma partitura neste projeto.</Alert>
      ) : (
        <Table bordered hover>
          <thead>
            <tr>
              <th>Título</th>
              <th>Compositor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score) => (
              <tr key={score.id}>
                <td>{resolveScoreMetadata(score).title}</td>
                <td>{resolveScoreMetadata(score).composer}</td>
                <td>
                  <Link to={scorePath(score.id)} size="sm" variant="secondary">
                      Ver
                    </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Page>
  );
}
