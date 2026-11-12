import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import type { WithId } from "../lib/db";
import { isAdmin } from "../lib/roles";

import { songbookPath } from "../lib/songbook";

import type { ProjectDoc } from "../../types/docs";
import type { SongbookItemViewModel } from "../../types/viewModels";

/**
 * Saves the homepage builder's list as a songbook of a project the user
 * administers. A user with no project is prompted to create one, rather
 * than getting one created silently.
 */
export type SaveSongbookModalServices = Pick<
  typeof import("../lib/db"),
  "getMemberRole" | "getUserMemberProjects"
> & {
  saveAsNewSongbook: typeof import("../lib/saveSongbook").saveAsNewSongbook;
};

export function SaveSongbookModalView({
  services,

  show,
  user,
  items,
  onHide,
}: {
  services: SaveSongbookModalServices;

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
      const memberOf = await services.getUserMemberProjects(user.uid);
      const roles = await Promise.all(
        memberOf.map((p) => services.getMemberRole(p.id, user.uid)),
      );
      const mine = memberOf.filter((_, i) => isAdmin(roles[i]));
      setProjects(mine);
      setProjectId(mine[0]?.id ?? "");
    })();
  }, [show, user, services]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const { slug } = await services.saveAsNewSongbook({
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
          ) : projects.length === 0 ? (
            <p className="mb-0">
              Você precisa administrar um projeto para salvar um caderninho.{" "}
              <Link to="/projects/new" onClick={onHide}>
                Criar um projeto
              </Link>
              .
            </p>
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
            disabled={pending || !projectId || items.length === 0}
          >
            {pending ? <Spinner animation="border" size="sm" /> : "Salvar"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
