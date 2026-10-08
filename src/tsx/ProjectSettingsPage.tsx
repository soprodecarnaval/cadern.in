import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Container,
  Form,
  Spinner,
  Table,
} from "react-bootstrap";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  getProjectBySlug,
  getProjectMembers,
  updateProjectTitle,
  removeProjectMember,
  updateProjectMemberRole,
  createUserProjectInvitation,
  getProjectUserProjectInvitations,
  cancelUserProjectInvitation,
  findUserForInvite,
  type WithId,
} from "../lib/db";
import {
  INVITABLE_ROLES,
  canGrantRole,
  canInvite,
  canRemoveMember,
  grantableRoles,
  isAdmin,
} from "../lib/roles";
import { displayNameOf } from "../lib/displayName";
import { useMemberRole } from "../lib/useMemberRole";
import type {
  InvitableRole,
  ProjectDoc,
  ProjectMemberDoc,
  UserProjectRole,
  UserProjectInvitationDoc,
} from "../../types/docs";

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

export function ProjectSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { currentUser } = useAuth();

  const myRole = useMemberRole(slug);
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

  const [inviteName, setInviteName] = useState("");
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
    void getProjectBySlug(slug).then((p) => {
      setProject(p);
      if (p) {
        setTitleInput(p.title);
      }
    });
    void getProjectMembers(slug).then(setMembers);
    void getProjectUserProjectInvitations(slug).then(setInvitations);
  }, [slug]);

  if (project === "loading" || myRole === "loading") {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!project || !currentUser) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Projeto não encontrado ou acesso negado.</Alert>
      </Container>
    );
  }

  if (!isAdmin(myRole)) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Sem permissão para acessar esta página.</Alert>
      </Container>
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
      await updateProjectTitle(slug, titleInput);
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
      const result = await findUserForInvite(slug, inviteName.trim());
      if (result.status === "not-found") {
        setInviteMessage({ ok: false, text: "Usuário não encontrado." });
        return;
      }
      if (result.status === "ambiguous") {
        setInviteMessage({
          ok: false,
          text: "Mais de um usuário com esse nome. Peça para a pessoa mudar o nome de usuário.",
        });
        return;
      }
      if (members.some((m) => m.uid === result.uid)) {
        setInviteMessage({
          ok: false,
          text: `${result.displayName} já é membro do projeto.`,
        });
        return;
      }
      await createUserProjectInvitation({
        fromUserId: currentUser.uid,
        toUserId: result.uid,
        projectId: slug,
        role: inviteRole,
        accepted: null,
        projectTitle: project.title,
        fromDisplayName: displayNameOf(currentUser),
        toDisplayName: result.displayName,
      });
      setInvitations(await getProjectUserProjectInvitations(slug));
      setInviteMessage({
        ok: true,
        text: `Convite enviado para ${result.displayName}!`,
      });
      setInviteName("");
    } catch (err: unknown) {
      setInviteMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao enviar convite",
      });
    } finally {
      setInvitePending(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserProjectRole) => {
    if (!slug) {
      return;
    }
    await updateProjectMemberRole(slug, uid, role);
    setMembers((prev) => prev.map((m) => (m.uid === uid ? { ...m, role } : m)));
  };

  const handleRemoveMember = async (uid: string) => {
    if (!slug || !confirm("Remover este membro do projeto?")) {
      return;
    }
    setRemovingMember(uid);
    try {
      await removeProjectMember(slug, uid);
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
      await cancelUserProjectInvitation(slug, toUserId);
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
    <Container className="mt-4" style={{ maxWidth: 680 }}>
      <h2 className="mb-4">Configurações: {project.title}</h2>

      {/* Title */}
      <section className="mb-5">
        <h5>Nome do projeto</h5>
        <Form onSubmit={(e) => void handleSaveTitle(e)}>
          <Form.Group className="mb-2">
            <Form.Control
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              required
            />
            <Form.Text className="text-muted">
              Slug: <code>/projects/{project.slug}</code> (imutável)
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
        <Table bordered size="sm">
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
                      <Form.Select
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
                      <Badge bg={ROLE_BADGE_VARIANTS[role]}>
                        {ROLE_LABELS[role]}
                      </Badge>
                    )}
                  </td>
                  {showRemoveColumn && (
                    <td>
                      {canRemoveMember(myRole, isSelf) && (
                        <Button
                          size="sm"
                          variant="outline-danger"
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
            <Form.Group>
              <Form.Label>Nome de usuário</Form.Label>
              <Form.Control
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome de usuário"
                required
                style={{ width: 240 }}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Papel</Form.Label>
              <Form.Select
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
            <Button type="submit" disabled={invitePending}>
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
          <Table bordered size="sm">
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
                    <Badge bg={ROLE_BADGE_VARIANTS[inv.role]}>
                      {ROLE_LABELS[inv.role]}
                    </Badge>
                  </td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-danger"
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
    </Container>
  );
}
