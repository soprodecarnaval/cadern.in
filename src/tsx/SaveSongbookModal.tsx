import { useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import {
  getMemberRole,
  getUserMemberProjects,
  type WithId,
} from "../lib/db";
import { isAdmin } from "../lib/roles";
import { saveAsNewSongbook } from "../lib/saveSongbook";
import { songbookPath } from "../lib/songbook";
import { getOrCreateDefaultProject } from "../lib/uploadScore";
import type { ProjectDoc } from "../../types/docs";
import type { SongbookItemViewModel } from "../../types/viewModels";

/**
 * Saves the homepage builder's list as a songbook of a project the user
 * administers, defaulting to their Acervo.
 */
export function SaveSongbookModal({
  show,
  user,
  items,
  onHide,
}: {
  show: boolean;
  user: User;
  items: SongbookItemViewModel[];
  onHide: () => void;
}) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<WithId<ProjectDoc>[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) {
      return;
    }
    void (async () => {
      const defaultId = await getOrCreateDefaultProject(user);
      const memberOf = await getUserMemberProjects(user.uid);
      const roles = await Promise.all(
        memberOf.map((p) => getMemberRole(p.id, user.uid)),
      );
      setProjects(memberOf.filter((_, i) => isAdmin(roles[i])));
      setProjectId(defaultId);
    })();
  }, [show, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const { slug } = await saveAsNewSongbook({
        projectId,
        title,
        items,
        user,
      });
      void navigate(songbookPath(projectId, slug));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setPending(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Form onSubmit={(e) => void handleSave(e)}>
        <Modal.Header closeButton>
          <Modal.Title>Salvar caderninho</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {projects === null ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Título</Form.Label>
                <Form.Control
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Projeto</Form.Label>
                <Form.Select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Partituras de outros projetos ficam vinculadas a este.
                </Form.Text>
              </Form.Group>
            </>
          )}
          {error && <div className="text-danger">{error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={pending || projects === null || items.length === 0}
          >
            {pending ? <Spinner animation="border" size="sm" /> : "Salvar"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
