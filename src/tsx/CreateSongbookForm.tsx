import { useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { slugify } from "../lib/slugify";
import { songbookPath } from "../lib/songbook";

type CreateSongbookServices = Pick<
  typeof import("../lib/db"),
  "createSongbook" | "getSongbook"
>;

export function CreateSongbookForm({
  services,
  currentUser,
  projectId,
  onCancel,
}: {
  services: CreateSongbookServices;
  currentUser: import("firebase/auth").User | null;
  projectId: string;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = slugify(title.trim());
    if (pending || !currentUser) {
      return;
    }
    if (!/[a-z0-9]/.test(slug)) {
      setError("Informe um título com letras ou números.");
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
      className="border rounded bg-light p-3 mb-3"
      aria-label="Novo caderninho"
    >
      <Form.Group controlId="new-songbook-title">
        <Form.Label>Título do novo caderninho</Form.Label>
        <Form.Control
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Carnaval 2027"
          required
          disabled={pending}
          autoFocus
          style={{ maxWidth: 480 }}
        />
      </Form.Group>
      {error && (
        <Alert variant="danger" className="mt-2 mb-0">{error}</Alert>
      )}
      <div className="d-flex gap-2 mt-3">
        <Button type="submit" disabled={pending || !currentUser}>
          {pending ? (
            <><Spinner animation="border" size="sm" /> Criando…</>
          ) : "Criar"}
        </Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </Form>
  );
}
