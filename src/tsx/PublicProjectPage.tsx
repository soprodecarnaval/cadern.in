import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Container,
  Spinner,
  Table,
} from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import {
  getProjectBySlug,
  getProjectScores,
  getProjectSongbooks,
  type WithId,
} from "../lib/db";
import { isAdmin, isReviewer } from "../lib/roles";
import { publicSongbookPath, songbookPath } from "../lib/songbook";
import { useMemberRole } from "../lib/useMemberRole";
import { resolveScoreMetadata } from "../lib/scoreMetadata";
import type {
  ProjectDoc,
  UserProjectRole,
  ScoreDoc,
  SongbookDoc,
} from "../../types/docs";

const ROLE_LABELS: Record<UserProjectRole, string> = {
  owner: "Dono",
  admin: "Admin",
  editor: "Editor",
  reviewer: "Revisor",
};

const ROLE_BADGE_VARIANTS: Record<UserProjectRole, string> = {
  owner: "primary",
  admin: "warning",
  editor: "info",
  reviewer: "secondary",
};

export function PublicProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const role = useMemberRole(slug);

  const [project, setProject] = useState<WithId<ProjectDoc> | null | "loading">(
    "loading",
  );
  const [scores, setScores] = useState<WithId<ScoreDoc>[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);
  const [songbooks, setSongbooks] = useState<WithId<SongbookDoc>[] | null>(
    null,
  );
  const isMember = role !== "loading" && isReviewer(role);

  useEffect(() => {
    if (!slug) {
      return;
    }
    void getProjectBySlug(slug).then(setProject);
  }, [slug]);

  // Non-members see only published songbooks, no score list (collab-flow §4.4).
  useEffect(() => {
    if (
      !slug ||
      project === "loading" ||
      project === null ||
      role === "loading"
    ) {
      return;
    }
    void getProjectSongbooks(slug, { publishedOnly: !isMember }).then(
      setSongbooks,
    );
    if (isMember) {
      void getProjectScores(slug).then((s) => {
        setScores(s);
        setScoresLoading(false);
      });
    }
  }, [slug, project, role, isMember]);

  if (project === "loading") {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!project || project.deletedAt) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Projeto não encontrado.</Alert>
      </Container>
    );
  }

  const myRole = role === "loading" ? undefined : role;
  const canManage = isAdmin(myRole);

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-start mb-1">
        <h2>{project.title}</h2>
        <div className="d-flex gap-2 align-items-center">
          {myRole && (
            <Badge bg={ROLE_BADGE_VARIANTS[myRole]}>
              {ROLE_LABELS[myRole]}
            </Badge>
          )}
          {canManage && (
            <Link to={`/projects/${slug ?? ""}/settings`}>
              <Button size="sm" variant="outline-primary">
                Configurações
              </Button>
            </Link>
          )}
        </div>
      </div>
      <p className="text-muted mb-4">
        <small>/{project.slug}</small>
      </p>

      <h5>Caderninhos</h5>
      {songbooks === null ? (
        <Spinner animation="border" />
      ) : songbooks.length === 0 ? (
        <Alert variant="info">
          {isMember ? "Nenhum caderninho ainda." : "Nenhum caderninho publicado."}
        </Alert>
      ) : (
        <Table hover className="mb-4">
          <tbody>
            {songbooks.map((sb) => (
              <tr key={sb.id}>
                <td>
                  <Link
                    to={
                      isMember
                        ? songbookPath(project.id, sb.slug)
                        : publicSongbookPath(project.id, sb.slug)
                    }
                  >
                    {sb.title}
                  </Link>
                </td>
                <td className="text-muted text-end">
                  {!sb.isPublished && "não publicado"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {isMember && (
        <p>
          <Link to={`/projects/${encodeURIComponent(project.id)}/songbooks`}>
            Gerenciar caderninhos
          </Link>
        </p>
      )}

      {isMember && <h5>Partituras</h5>}
      {!isMember ? null : scoresLoading ? (
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
                  <Link to={`/score/${encodeURIComponent(score.id)}`}>
                    <Button size="sm" variant="outline-secondary">
                      Ver
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
