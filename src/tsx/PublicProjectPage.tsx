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
import { useAuth } from "../auth";
import { getProjectBySlug, getProjectScores, type WithId } from "../lib/db";
import { memberRole, isAdmin } from "../lib/roles";
import type { ProjectDoc, UserProjectRole, ScoreDoc } from "../../types/docs";

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
  const { currentUser } = useAuth();

  const [project, setProject] = useState<WithId<ProjectDoc> | null | "loading">(
    "loading",
  );
  const [scores, setScores] = useState<WithId<ScoreDoc>[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      return;
    }
    void getProjectBySlug(slug).then(setProject);
  }, [slug]);

  useEffect(() => {
    if (!slug || project === "loading" || project === null) {
      return;
    }
    void getProjectScores(slug).then((s) => {
      setScores(s);
      setScoresLoading(false);
    });
  }, [slug, project]);

  if (project === "loading") {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!project) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Projeto não encontrado.</Alert>
      </Container>
    );
  }

  const myRole = currentUser ? memberRole(project, currentUser.uid) : undefined;
  const canManage = currentUser ? isAdmin(project, currentUser.uid) : false;

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

      <h5>Partituras</h5>
      {scoresLoading ? (
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
                <td>{score.title}</td>
                <td>{score.composer}</td>
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
