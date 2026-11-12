import { useState } from "react";
import { Alert, Button, Container, Form, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

import { displayNameOf } from "../lib/displayName";
import { slugify } from "../lib/slugify";

export type CreateProjectPageServices = Pick<
  typeof import("../lib/db"),
  "createProject" | "getProjectBySlug"
>;

export function CreateProjectPageView({
  services,
  currentUser,
}: {
  services: CreateProjectPageServices;
  currentUser: import("firebase/auth").User | null;
}) {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const slug = slugify(title);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !slug) {
      return;
    }

    setError("");
    setPending(true);
    try {
      const existing = await services.getProjectBySlug(slug);
      if (existing) {
        setError(`O slug "${slug}" já está em uso. Escolha outro nome.`);
        return;
      }
      await services.createProject(
        slug,
        { title },
        { uid: currentUser.uid, displayName: displayNameOf(currentUser) },
      );
      void navigate(`/projects/${slug}/settings`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar projeto");
    } finally {
      setPending(false);
    }
  };

  if (!currentUser) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">Faça login para criar um projeto.</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4" style={{ maxWidth: 480 }}>
      <h2 className="mb-4">Novo projeto</h2>

      <Form onSubmit={(e) => void handleSubmit(e)}>
        <Form.Group className="mb-3">
          <Form.Label>Nome</Form.Label>
          <Form.Control
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do projeto"
            required
          />
          {title && (
            <Form.Text className="text-muted">
              URL: <code>/projects/{slug}</code>
            </Form.Text>
          )}
        </Form.Group>

        {error && <Alert variant="danger">{error}</Alert>}

        <Button type="submit" variant="primary" disabled={pending || !slug}>
          {pending ? <Spinner animation="border" size="sm" /> : "Criar projeto"}
        </Button>
      </Form>
    </Container>
  );
}
