import { Page } from "../../../atoms/Page";
import { Link } from "../../../atoms/Link";
import { useEffect, useState } from "react";
import { Alert, Card, Col, Row, Spinner } from "react-bootstrap";
import { Badge } from "../../../atoms/Badge";

import type { WithId } from "../../../../lib/db";
import { isAdmin } from "../../../../lib/roles";
import { newProjectPath, projectPath, projectSettingsPath } from "../../../../lib/routes";

import type { ProjectDoc, UserProjectRole } from "../../../../../types/docs";

const ROLE_LABELS: Record<UserProjectRole, string> = {
  owner: "Dono",
  admin: "Admin",
  editor: "Editor",
  reviewer: "Revisor",
};

function ProjectCard({
  services,
  currentUser,
  project,
}: {
  services: MeusProjetosPageServices;
  currentUser: import("firebase/auth").User | null;
  project: WithId<ProjectDoc>;
}) {
  const [myRole, setMyRole] = useState<import("../../../../lib/roles").Role | "loading">(
    "loading",
  );
  useEffect(() => {
    if (!currentUser) {
      setMyRole(undefined);
      return;
    }
    setMyRole("loading");
    void services.getMemberRole(project.slug, currentUser.uid).then(setMyRole);
  }, [project.slug, currentUser, services]);
  const [scoreCount, setScoreCount] = useState<number | null>(null);

  useEffect(() => {
    void services
      .getProjectScores(project.id)
      .then((scores) => setScoreCount(scores.length));
  }, [project.id, services]);

  return (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <Card.Title className="mb-0">{project.title}</Card.Title>
          {myRole && myRole !== "loading" && (
            <Badge variant="strong">
              {ROLE_LABELS[myRole]}
            </Badge>
          )}
        </div>
        <Card.Subtitle className="text-muted mb-3">
          <small>/{project.slug}</small>
        </Card.Subtitle>
        <div className="text-muted mb-3">
          {scoreCount === null ? (
            <Spinner animation="border" size="sm" />
          ) : (
            `${scoreCount} partitura${scoreCount !== 1 ? "s" : ""}`
          )}
        </div>
        <div className="d-flex gap-2">
          <Link to={projectPath(project.slug)} size="sm" variant="secondary">
              Ver
            </Link>
          {myRole !== "loading" && isAdmin(myRole) && (
            <Link to={projectSettingsPath(project.slug)} size="sm" variant="secondary">
                Configurações
              </Link>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export type MeusProjetosPageServices = Pick<
  typeof import("../../../../lib/db"),
  "getUserMemberProjects" | "getProjectScores" | "getMemberRole"
>;

export function MeusProjetosPageView({
  services,
  currentUser,
}: {
  services: MeusProjetosPageServices;
  currentUser: import("firebase/auth").User | null;
}) {
  const [projects, setProjects] = useState<WithId<ProjectDoc>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    void services.getUserMemberProjects(currentUser.uid).then((results) => {
      setProjects(results);
      setLoading(false);
    });
  }, [currentUser, services]);

  if (!currentUser) {
    return (
      <Page className="mt-4">
        <Alert variant="warning">Faça login para ver seus projetos.</Alert>
      </Page>
    );
  }

  return (
    <Page className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Meus projetos</h2>
        <Link to={newProjectPath()} variant="primary">Novo projeto</Link>
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : projects.length === 0 ? (
        <Alert variant="info">
          Você ainda não participa de nenhum projeto.
        </Alert>
      ) : (
        <Row xs={1} sm={2} lg={3} className="g-3">
          {projects.map((project) => (
            <Col key={project.id}>
              <ProjectCard
                services={services}
                currentUser={currentUser}
                project={project}
              />
            </Col>
          ))}
        </Row>
      )}
    </Page>
  );
}
