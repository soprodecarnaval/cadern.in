import { Page } from "../../../atoms/Page";
import { Link } from "../../../atoms/Link";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../atoms/Button";
import { ProjectPickerModal } from "../../../components/projects/ProjectPickerModal";
import { FEATURE_FLAG_BROWSER_UPLOAD } from "../../../../featureFlags";
import { uploadPath } from "../../../../lib/uploadPath";
import { Alert, Card, Col, Row, Spinner } from "react-bootstrap";
import { Badge } from "../../../atoms/Badge";

import type { WithId } from "../../../../lib/db";
import { isAdmin, isEditor } from "../../../../lib/roles";
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
        <div className="d-flex flex-wrap gap-2">
          <Link to={projectPath(project.slug)} size="sm" variant="secondary">
              Ver
            </Link>
          {FEATURE_FLAG_BROWSER_UPLOAD && myRole !== "loading" && isEditor(myRole) && (
            <Link to={uploadPath({ projectId: project.id })} size="sm" variant="secondary">
              Enviar partitura
            </Link>
          )}
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
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

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
      <div className="d-flex justify-content-between align-items-center mb-4 gap-2 flex-wrap">
        <h2>Meus projetos</h2>
        <div className="d-flex flex-wrap gap-2">
          {FEATURE_FLAG_BROWSER_UPLOAD && projects.length > 0 && (
            <Button onClick={() => setSending(true)}>Enviar partitura</Button>
          )}
          <Link to={newProjectPath()} variant={projects.length > 0 && FEATURE_FLAG_BROWSER_UPLOAD ? "secondary" : "primary"}>
            Novo projeto
          </Link>
        </div>
      </div>
      <ProjectPickerModal
        show={sending}
        user={currentUser}
        services={services}
        allow={isEditor}
        heading="Enviar partitura"
        description="Escolha o projeto que vai receber a partitura."
        confirmLabel="Continuar"
        onHide={() => setSending(false)}
        onConfirm={(projectId) => {
          setSending(false);
          void navigate(uploadPath({ projectId }));
        }}
      />

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
