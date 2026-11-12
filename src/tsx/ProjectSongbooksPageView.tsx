import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Container,
  Form,
  ListGroup,
  Spinner,
} from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { WithId } from "../lib/db";
import { isAdmin, isReviewer } from "../lib/roles";
import { slugify } from "../lib/slugify";
import { songbookPath } from "../lib/songbook";

import type { ProjectDoc, SongbookDoc } from "../../types/docs";

/** A project's songbooks: all of them for members, published ones otherwise. */
export type ProjectSongbooksPageServices = Pick<
  typeof import("../lib/db"),
  "createSongbook" | "getProjectBySlug" | "getProjectSongbooks" | "getSongbook"
>;

export function ProjectSongbooksPageView({
  services,
  currentUser,
  role,
}: {
  services: ProjectSongbooksPageServices;
  currentUser: import("firebase/auth").User | null;
  role: import("../lib/roles").Role | "loading";
}) {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<WithId<ProjectDoc> | null | "loading">(
    "loading",
  );
  const [songbooks, setSongbooks] = useState<WithId<SongbookDoc>[] | null>(
    null,
  );

  useEffect(() => {
    if (!slug) {
      return;
    }
    void services.getProjectBySlug(slug).then(setProject);
  }, [slug, services]);

  useEffect(() => {
    if (!slug || role === "loading") {
      return;
    }
    void services
      .getProjectSongbooks(slug, { publishedOnly: !isReviewer(role) })
      .then(setSongbooks);
  }, [slug, role, services]);

  if (project === "loading" || role === "loading" || songbooks === null) {
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

  return (
    <Container className="mt-4" style={{ maxWidth: 680 }}>
      <h2>
        <Link to={`/projects/${encodeURIComponent(project.id)}`}>
          {project.title}
        </Link>{" "}
        · Caderninhos
      </h2>
      {songbooks.length === 0 ? (
        <Alert variant="info" className="mt-3">
          Nenhum caderninho ainda.
        </Alert>
      ) : (
        <ListGroup className="mt-3">
          {songbooks.map((sb) => (
            <ListGroup.Item
              key={sb.id}
              action
              as={Link}
              to={songbookPath(project.id, sb.slug)}
              className="d-flex justify-content-between"
            >
              {sb.title}
              {!sb.isPublished && (
                <span className="text-muted">não publicado</span>
              )}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {isAdmin(role) && (
        <CreateSongbookForm
          services={services}
          currentUser={currentUser}
          projectId={project.id}
        />
      )}
    </Container>
  );
}

function CreateSongbookForm({
  services,
  currentUser,
  projectId,
}: {
  services: ProjectSongbooksPageServices;
  currentUser: import("firebase/auth").User | null;
  projectId: string;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = slugify(title);
    if (!currentUser || !slug) {
      return;
    }
    setPending(true);
    setError("");
    try {
      if (await services.getSongbook(projectId, slug)) {
        throw new Error("Já existe um caderninho com esse título.");
      }
      await services.createSongbook({
        projectId,
        slug,
        title: title.trim(),
        content: { entries: [], pins: {}, covers: {} },
        createdBy: currentUser.uid,
      });
      void navigate(songbookPath(projectId, slug));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
      setPending(false);
    }
  };

  return (
    <Form
      onSubmit={(e) => void handleCreate(e)}
      className="d-flex gap-2 mt-4 align-items-start"
    >
      <Form.Control
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do novo caderninho"
        required
        style={{ width: 280 }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner animation="border" size="sm" /> : "Criar"}
      </Button>
      {error && <span className="text-danger align-self-center">{error}</span>}
    </Form>
  );
}
