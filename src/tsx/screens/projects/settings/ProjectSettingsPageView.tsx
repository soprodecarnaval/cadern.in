import { Button } from "../../../atoms/Button";
import { Page } from "../../../atoms/Page";
import { Input } from "../../../atoms/Input";
import { useEffect, useState } from "react";
import { Alert, Form, Spinner, Table } from "react-bootstrap";
import { Badge } from "../../../atoms/Badge";
import { useNavigate, useParams } from "react-router-dom";
import { projectPath, projectsPath } from "../../../../lib/routes";

import type { WithId } from "../../../../lib/db";
import { displayNameOf } from "../../../../lib/displayName";
import {
  INVITABLE_ROLES,
  canDeleteProject,
  canGrantRole,
  canInvite,
  canRemoveMember,
  grantableRoles,
  isAdmin,
} from "../../../../lib/roles";

import type {
  InvitableRole,
  ProjectDoc,
  ProjectMemberDoc,
  UserProjectInvitationDoc,
  UserProjectRole,
} from "../../../../../types/docs";

const ROLE_LABELS: Record<UserProjectRole, string> = {
  owner: "Dono",
  admin: "Admin",
  editor: "Editor",
  reviewer: "Revisor",
};

function formatDate(timestamp: unknown): string {
  if (!timestamp || typeof timestamp !== "object") {
    return "—";
  }
  const ts = timestamp as { toDate?: () => Date };
  if (!ts.toDate) {
    return "—";
  }
  return ts.toDate().toLocaleDateString("pt-BR");
}

export type ProjectSettingsPageServices = Pick<
  typeof import("../../../../lib/db"),
  | "getProjectBySlug"
  | "getProjectMembers"
  | "updateProjectTitle"
  | "removeProjectMember"
  | "updateProjectMemberRole"
  | "createUserProjectInvitation"
  | "getProjectUserProjectInvitations"
  | "cancelUserProjectInvitation"
  | "findUserForInvite"
  | "softDeleteProject"
>;

export function ProjectSettingsPageView({
  services,
  currentUser,
  myRole,
}: {
  services: ProjectSettingsPageServices;
  currentUser: import("firebase/auth").User | null;
  myRole: import("../../../../lib/roles").Role | "loading";
}) {
  const { slug } = useParams<{ slug: string }>();

  const navigate = useNavigate();
  const [project, setProject] = useState<WithId<ProjectDoc> | null | "loading">(
    "loading",
  );
  const [members, setMembers] = useState<ProjectMemberDoc[]>([]);
  const [invitations, setInvitations] = useState<
    WithId<UserProjectInvitationDoc>[]
  >([]);

  const [titleInput, setTitleInput] = useState("");
  const [titlePending, setTitlePending] = useState(false);
  const [titleSuccess, setTitleSuccess] = useState("");
  const [titleError, setTitleError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("reviewer");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }
    void services.getProjectBySlug(slug).then((p) => {
      setProject(p);
      if (p) {
        setTitleInput(p.title);
      }
    });
    void services.getProjectMembers(slug).then(setMembers);
    void services.getProjectUserProjectInvitations(slug).then(setInvitations);
  }, [slug, services]);

  if (project === "loading" || myRole === "loading") {
    return (
      <Page className="mt-4">
        <Spinner animation="border" />
      </Page>
    );
  }

  if (!project || project.deletedAt || !currentUser) {
    return (
      <Page className="mt-4">
        <Alert variant="danger">Projeto não encontrado ou acesso negado.</Alert>
      </Page>
    );
  }

  if (!isAdmin(myRole)) {
    return (
      <Page className="mt-4">
        <Alert variant="danger">Sem permissão para acessar esta página.</Alert>
      </Page>
    );
  }

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) {
      return;
    }
    setTitleError("");
    setTitleSuccess("");
    setTitlePending(true);
    try {
      await services.updateProjectTitle(slug, titleInput);
      setProject({ ...project, title: titleInput });
      setTitleSuccess("Nome atualizado!");
    } catch (err: unknown) {
      setTitleError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setTitlePending(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) {
      return;
    }
    setInvitePending(true);
    setInviteMessage(null);
    try {
      const result = await services.findUserForInvite(slug, inviteEmail.trim());
      if (result.status === "not-found") {
        setInviteMessage({ ok: false, text: "Nenhuma conta encontrada para este e-mail." });
        return;
      }
      if (members.some((m) => m.uid === result.uid)) {
        setInviteMessage({
          ok: false,
          text: `${result.displayName} já é membro do projeto.`,
        });
        return;
      }
      await services.createUserProjectInvitation({
        fromUserId: currentUser.uid,
        toUserId: result.uid,
        projectId: slug,
        role: inviteRole,
        accepted: null,
        projectTitle: project.title,
        fromDisplayName: displayNameOf(currentUser),
        toDisplayName: result.displayName,
      });
      setInvitations(await services.getProjectUserProjectInvitations(slug));
      setInviteMessage({
        ok: true,
        text: `Convite enviado para ${result.displayName}!`,
      });
      setInviteEmail("");
    } catch {
      setInviteMessage({
        ok: false,
        text: "Não foi possível enviar o convite. Tente novamente.",
      });
    } finally {
      setInvitePending(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserProjectRole) => {
    if (!slug) {
      return;
    }
    await services.updateProjectMemberRole(slug, uid, role);
    setMembers((prev) => prev.map((m) => (m.uid === uid ? { ...m, role } : m)));
  };

  const handleRemoveMember = async (uid: string) => {
    if (!slug || !confirm("Remover este membro do projeto?")) {
      return;
    }
    setRemovingMember(uid);
    try {
      await services.removeProjectMember(slug, uid);
      setMembers((prev) => prev.filter((m) => m.uid !== uid));
    } finally {
      setRemovingMember(null);
    }
  };

  const handleCancelInvitation = async (toUserId: string) => {
    if (!slug || !confirm("Cancelar este convite?")) {
      return;
    }
    setCancellingInvite(toUserId);
    try {
      await services.cancelUserProjectInvitation(slug, toUserId);
      setInvitations((prev) => prev.filter((inv) => inv.toUserId !== toUserId));
    } finally {
      setCancellingInvite(null);
    }
  };

  const showRemoveColumn = members.some((m) =>
    canRemoveMember(myRole, m.uid === currentUser.uid),
  );
  const pendingInvitations = invitations.filter((inv) => inv.accepted === null);

  return (
    <Page className="mt-4" style={{ maxWidth: 680 }}>
      <h2 className="mb-4">Configurações: {project.title}</h2>

      {/* Title */}
      <section className="mb-5">
        <h5>Nome do projeto</h5>
        <Form onSubmit={(e) => void handleSaveTitle(e)}>
          <Form.Group className="mb-2">
            <Form.Control as={Input}
              aria-label="Nome do projeto"
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              required
            />
            <Form.Text className="text-muted">
              Slug: <code className="text-black">{projectPath(project.slug)}</code> (imutável)
            </Form.Text>
          </Form.Group>
          <Button type="submit" size="sm" disabled={titlePending}>
            {titlePending ? <Spinner animation="border" size="sm" /> : "Salvar"}
          </Button>
          {titleSuccess && (
            <span className="ms-2 text-success">{titleSuccess}</span>
          )}
          {titleError && <span className="ms-2 text-danger">{titleError}</span>}
        </Form>
      </section>

      {/* Members */}
      <section className="mb-5">
        <h5>Membros</h5>
        <Table bordered size="sm" className="align-middle">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Papel</th>
              {showRemoveColumn && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map(({ uid, role, displayName }) => {
              const isSelf = uid === currentUser.uid;
              const options = grantableRoles(myRole).filter(
                (r) => r === role || canGrantRole(myRole, role, r, isSelf),
              );
              return (
                <tr key={uid}>
                  <td>
                    {displayName}
                    {isSelf && <span className="text-muted"> (você)</span>}
                  </td>
                  <td>
                    {options.length > 1 ? (
                      <Form.Select className="ds-field ds-select"
                        size="sm"
                        value={role}
                        onChange={(e) =>
                          void handleRoleChange(
                            uid,
                            e.target.value as UserProjectRole,
                          )
                        }
                        style={{ width: "auto" }}
                      >
                        {options.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Form.Select>
                    ) : (
                      <Badge variant="strong">
                        {ROLE_LABELS[role]}
                      </Badge>
                    )}
                  </td>
                  {showRemoveColumn && (
                    <td>
                      {canRemoveMember(myRole, isSelf) && (
                        <Button
                          size="sm"
                          variant="danger-secondary"
                          disabled={removingMember === uid}
                          onClick={() => void handleRemoveMember(uid)}
                        >
                          {removingMember === uid ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            "Remover"
                          )}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>

      {/* Invite */}
      {canInvite(myRole) && (
        <section className="mb-5">
          <h5>Convidar</h5>
          <Form
            onSubmit={(e) => void handleInvite(e)}
            className="d-flex gap-2 align-items-end flex-wrap"
          >
            <Form.Group controlId="project-invite-email">
              <Form.Label>E-mail</Form.Label>
              <Form.Control as={Input}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onBlur={() => setInviteEmail((email) => email.trim())}
                placeholder="E-mail"
                required
                style={{ width: 240 }}
              />
            </Form.Group>
            <Form.Group controlId="project-invite-role">
              <Form.Label>Papel</Form.Label>
              <Form.Select className="ds-field ds-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InvitableRole)}
                style={{ width: "auto" }}
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            {/* As tall as the fields beside it (48px). */}
            <Button type="submit" disabled={invitePending} style={{ minHeight: 48 }}>
              {invitePending ? (
                <Spinner animation="border" size="sm" />
              ) : (
                "Convidar"
              )}
            </Button>
            {inviteMessage && (
              <span
                className={`${inviteMessage.ok ? "text-success" : "text-danger"} align-self-end`}
              >
                {inviteMessage.text}
              </span>
            )}
          </Form>
        </section>
      )}

      {/* Pending invitations log */}
      {pendingInvitations.length > 0 && (
        <section className="mb-5">
          <h5>Convites pendentes</h5>
          <Table bordered size="sm" className="align-middle">
            <thead>
              <tr>
                <th>Para</th>
                <th>Papel</th>
                <th>Enviado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingInvitations.map((inv) => (
                <tr key={inv.toUserId}>
                  <td>{inv.toDisplayName}</td>
                  <td>
                    <Badge variant="strong">
                      {ROLE_LABELS[inv.role]}
                    </Badge>
                  </td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={cancellingInvite === inv.toUserId}
                      onClick={() => void handleCancelInvitation(inv.toUserId)}
                    >
                      {cancellingInvite === inv.toUserId ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        "Cancelar"
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {canDeleteProject(myRole) && (
        <DeleteProjectSection
          services={services}
          project={project}
          onDeleted={() => void navigate(projectsPath())}
        />
      )}
    </Page>
  );
}

/**
 * Owner-only. Asks for the project's name before soft-deleting it, since its
 * scores disappear with it and there is no restore in the app.
 */
function DeleteProjectSection({
  services,
  project,
  onDeleted,
}: {
  services: ProjectSettingsPageServices;
  project: WithId<ProjectDoc>;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await services.softDeleteProject(project.id);
      onDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
      setPending(false);
    }
  };

  return (
    <section className="mb-5 border border-danger rounded p-3">
      <h5 className="text-danger">Zona de perigo</h5>
      <p className="mb-2">
        Excluir o projeto esconde todas as suas partituras e não pode ser
        desfeito pelo site. Para confirmar, digite o nome do projeto:{" "}
        <strong>{project.title}</strong>
      </p>
      <Form
        onSubmit={(e) => void handleDelete(e)}
        className="d-flex gap-2 align-items-start flex-wrap"
      >
        <Form.Control as={Input}
          aria-label="Confirme o nome do projeto"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={project.title}
          style={{ width: 240 }}
        />
        <Button
          type="submit"
          variant="danger"
          disabled={pending || confirmation !== project.title}
          style={{ minHeight: 48 }}
        >
          {pending ? (
            <Spinner animation="border" size="sm" />
          ) : (
            "Excluir projeto"
          )}
        </Button>
      </Form>
      {error && <div className="text-danger mt-2">{error}</div>}
    </section>
  );
}
