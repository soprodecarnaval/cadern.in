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
  updateProjectTitle,
  removeProjectMember,
  updateProjectMemberRole,
  createUserProjectInvitation,
  getProjectUserProjectInvitations,
  cancelUserProjectInvitation,
  getUserByEmail,
  type WithId,
} from "../lib/db";
import { isAdmin as isAdminRole, isOwner as isOwnerRole } from "../lib/roles";
import type {
  ProjectDoc,
  UserProjectRole,
  UserProjectInvitationDoc,
} from "../../types/docs";

const ALL_ROLES: UserProjectRole[] = ["reviewer", "editor", "admin", "owner"];

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
  if (!timestamp || typeof timestamp !== "object") return "—";
  const ts = timestamp as { toDate?: () => Date };
  if (!ts.toDate) return "—";
  return ts.toDate().toLocaleDateString("pt-BR");
}

export function ProjectSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { currentUser } = useAuth();

  const [project, setProject] = useState<WithId<ProjectDoc> | null | "loading">("loading");
  const [invitations, setInvitations] = useState<WithId<UserProjectInvitationDoc>[]>([]);

  const [titleInput, setTitleInput] = useState("");
  const [titlePending, setTitlePending] = useState(false);
  const [titleSuccess, setTitleSuccess] = useState("");
  const [titleError, setTitleError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserProjectRole>("reviewer");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getProjectBySlug(slug).then((p) => {
      setProject(p);
      if (p) setTitleInput(p.title);
    });
    getProjectUserProjectInvitations(slug).then(setInvitations);
  }, [slug]);

  if (project === "loading") {
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

  if (!isAdminRole(project, currentUser.uid)) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Sem permissão para acessar esta página.</Alert>
      </Container>
    );
  }
  const isOwner = isOwnerRole(project, currentUser.uid);

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
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
    if (!slug || !currentUser) return;
    setInvitePending(true);
    setInviteMessage("");
    try {
      const user = await getUserByEmail(inviteEmail.trim());
      if (user) {
        await createUserProjectInvitation({
          fromUserId: currentUser.uid,
          toUserId: user.id,
          projectId: slug,
          role: inviteRole,
          accepted: null,
        });
        const updated = await getProjectUserProjectInvitations(slug);
        setInvitations(updated);
      }
      // Always show success — avoids email enumeration
      setInviteMessage("Convite enviado!");
      setInviteEmail("");
    } catch (err: unknown) {
      setInviteMessage(
        err instanceof Error ? err.message : "Erro ao enviar convite",
      );
    } finally {
      setInvitePending(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserProjectRole) => {
    if (!slug) return;
    await updateProjectMemberRole(slug, uid, role);
    setProject({
      ...project,
      members: { ...project.members, [uid]: role },
    });
  };

  const handleRemoveMember = async (uid: string) => {
    if (!slug || !confirm("Remover este membro do projeto?")) return;
    setRemovingMember(uid);
    try {
      await removeProjectMember(slug, uid);
      const updated = { ...project.members };
      delete updated[uid];
      setProject({ ...project, members: updated });
    } finally {
      setRemovingMember(null);
    }
  };

  const handleCancelInvitation = async (id: string) => {
    if (!confirm("Cancelar este convite?")) return;
    setCancellingInvite(id);
    try {
      await cancelUserProjectInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } finally {
      setCancellingInvite(null);
    }
  };

  const members = Object.entries(project.members) as [string, UserProjectRole][];
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
          {titleSuccess && <span className="ms-2 text-success">{titleSuccess}</span>}
          {titleError && <span className="ms-2 text-danger">{titleError}</span>}
        </Form>
      </section>

      {/* Members */}
      <section className="mb-5">
        <h5>Membros</h5>
        <Table bordered size="sm">
          <thead>
            <tr>
              <th>UID</th>
              <th>Papel</th>
              {isOwner && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map(([uid, role]) => (
              <tr key={uid}>
                <td className="font-monospace" style={{ fontSize: 12 }}>
                  {uid}
                </td>
                <td>
                  {role === "owner" ? (
                    <Badge bg={ROLE_BADGE_VARIANTS[role]}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  ) : (
                    <Form.Select
                      size="sm"
                      value={role}
                      onChange={(e) =>
                        void handleRoleChange(uid, e.target.value as UserProjectRole)
                      }
                      style={{ width: "auto" }}
                    >
                      {ALL_ROLES.filter((r) => r !== "owner").map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                </td>
                {isOwner && (
                  <td>
                    {role !== "owner" && (
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
            ))}
          </tbody>
        </Table>
      </section>

      {/* Invite */}
      <section className="mb-5">
        <h5>Convidar</h5>
        <Form onSubmit={(e) => void handleInvite(e)} className="d-flex gap-2 align-items-end flex-wrap">
          <Form.Group>
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@exemplo.com"
              required
              style={{ width: 240 }}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Papel</Form.Label>
            <Form.Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserProjectRole)}
              style={{ width: "auto" }}
            >
              {ALL_ROLES.filter((r) => r !== "owner").map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Button type="submit" disabled={invitePending}>
            {invitePending ? <Spinner animation="border" size="sm" /> : "Convidar"}
          </Button>
          {inviteMessage && (
            <span className="text-success align-self-end">{inviteMessage}</span>
          )}
        </Form>
      </section>

      {/* Pending invitations log */}
      {pendingInvitations.length > 0 && (
        <section className="mb-5">
          <h5>Convites pendentes</h5>
          <Table bordered size="sm">
            <thead>
              <tr>
                <th>Para (UID)</th>
                <th>Papel</th>
                <th>Enviado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingInvitations.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-monospace" style={{ fontSize: 12 }}>
                    {inv.toUserId}
                  </td>
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
                      disabled={cancellingInvite === inv.id}
                      onClick={() => void handleCancelInvitation(inv.id)}
                    >
                      {cancellingInvite === inv.id ? (
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
