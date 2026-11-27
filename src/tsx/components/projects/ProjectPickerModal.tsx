import { useEffect, useState, type FormEvent } from "react";
import { Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import type { User } from "firebase/auth";
import type { WithId } from "../../../lib/db";
import type { Role } from "../../../lib/roles";
import { newProjectPath } from "../../../lib/routes";
import type { ProjectDoc } from "../../../../types/docs";
import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Modal } from "../../atoms/Modal";
import { Select } from "../../atoms/Select";

export type ProjectPickerServices = Pick<
  typeof import("../../../lib/db"),
  "getMemberRole" | "getUserMemberProjects"
>;

// The personal "Acervo @usuário" project first, then by title.
const isAcervo = (p: ProjectDoc) => p.title.startsWith("Acervo @");
const byAcervoThenTitle = (a: WithId<ProjectDoc>, b: WithId<ProjectDoc>) =>
  Number(isAcervo(b)) - Number(isAcervo(a)) || a.title.localeCompare(b.title, "pt-BR");

/** The signed-in person's projects where `allow(role)` holds, Acervo first. */
async function loadAllowedProjects(
  uid: string,
  allow: (role: Role) => boolean,
  services: ProjectPickerServices,
): Promise<WithId<ProjectDoc>[]> {
  const memberOf = await services.getUserMemberProjects(uid);
  const roles = await Promise.all(memberOf.map((p) => services.getMemberRole(p.id, uid)));
  return memberOf.filter((_, i) => allow(roles[i])).sort(byAcervoThenTitle);
}

/**
 * Picks one of the person's projects (tickets 029, 031, 032), optionally with
 * a name field. A person with no allowed project is offered to create one.
 */
export function ProjectPickerModal({
  show,
  user,
  services,
  allow,
  heading,
  description,
  confirmLabel,
  preferredProjectId,
  exclude,
  nameField,
  onHide,
  onConfirm,
}: {
  show: boolean;
  user: User;
  services: ProjectPickerServices;
  allow: (role: Role) => boolean;
  heading: string;
  description?: string;
  confirmLabel: string;
  // Preselected when allowed, e.g. the project that already has a copy.
  preferredProjectId?: string;
  // Projects not offered, e.g. the one the item is already in.
  exclude?: string[];
  nameField?: { label: string; initial: string };
  onHide: () => void;
  // Rejecting shows the error's message and keeps the modal open.
  onConfirm: (projectId: string, name: string) => Promise<void> | void;
}) {
  const [projects, setProjects] = useState<WithId<ProjectDoc>[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState(nameField?.initial ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const excludeKey = (exclude ?? []).join("\n");

  useEffect(() => {
    if (!show) {
      return;
    }
    let active = true;
    setProjects(null);
    setLoadError(false);
    setError("");
    setPending(false);
    setName(nameField?.initial ?? "");
    const excluded = new Set(excludeKey ? excludeKey.split("\n") : []);
    loadAllowedProjects(user.uid, allow, services).then(
      (allowed) => {
        if (!active) {return;}
        const offered = allowed.filter((p) => !excluded.has(p.id));
        setProjects(offered);
        setProjectId(
          offered.find((p) => p.id === preferredProjectId)?.id ?? offered[0]?.id ?? "",
        );
      },
      () => {
        if (active) {setLoadError(true);}
      },
    );
    return () => {
      active = false;
    };
    // `allow` and `nameField` are read when the modal opens only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, user, services, preferredProjectId, excludeKey]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || pending) {return;}
    setPending(true);
    setError("");
    try {
      await onConfirm(projectId, name.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Form onSubmit={(e) => void submit(e)}>
        <Modal.Header closeButton>
          <Modal.Title>{heading}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {description && <p>{description}</p>}
          {loadError ? (
            <div className="text-danger">Não foi possível carregar seus projetos.</div>
          ) : projects === null ? (
            <Spinner animation="border" size="sm" />
          ) : projects.length === 0 ? (
            <p className="mb-0">
              Você não tem um projeto onde possa salvar.{" "}
              <Link to={newProjectPath()} onClick={onHide}>
                Criar um novo projeto
              </Link>
              .
            </p>
          ) : (
            <>
              {nameField && (
                <Form.Group className="mb-3" controlId="project-picker-name">
                  <Form.Label>{nameField.label}</Form.Label>
                  <Form.Control
                    as={Input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Form.Group>
              )}
              <Form.Group className="mb-3" controlId="project-picker-project">
                <Form.Label>Projeto</Form.Label>
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Form.Group>
            </>
          )}
          {error && <div role="alert" className="text-danger">{error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={pending || !projectId || (!!nameField && !name.trim())}
          >
            {pending ? <Spinner animation="border" size="sm" /> : confirmLabel}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
