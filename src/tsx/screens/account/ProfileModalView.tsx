import { Modal } from "../../atoms/Modal";
import { Input } from "../../atoms/Input";
import { Button } from "../../atoms/Button";
import "./ProfileModal.css";
import { describeAuthError } from "../../../lib/authMessages";
import { useEffect, useRef, useState } from "react";
import { Spinner, Tab, Tabs } from "react-bootstrap";

import type { UserProjectInvitationDoc } from "../../../../types/docs";
import type { WithId } from "../../../lib/db";
import { displayNameOf, initialsOf } from "../../../lib/displayName";
import "../../atoms/Modal.css";
import { resizeImage } from "../../../utils/image";
import type { ScoreReviewRequest } from "../../../lib/scoreReviewRequests";
import { scoreRevisionPath } from "../../../lib/routes";
import { Link } from "../../atoms/Link";

export type ProfileModalServices = Pick<
  typeof import("../../../lib/db"),
  | "getPendingUserProjectInvitations"
  | "acceptUserProjectInvitation"
  | "denyUserProjectInvitation"
> &
  Pick<
    ReturnType<typeof import("../../../auth").useAuth>,
    "updateDisplayName" | "updateAvatar" | "changePassword" | "logout"
  >;

type InboxServices = ProfileModalServices & {
  listPendingScoreReviewRequests?: (uid: string) => Promise<ScoreReviewRequest[]>;
};

export type ProfileTab = "profile" | "inbox" | "password";

interface ProfileModalViewProps {
  services: InboxServices;
  currentUser: import("firebase/auth").User | null;
  show: boolean;
  onHide: () => void;
  /** The tab shown each time the modal opens. Defaults to the profile. */
  initialTab?: ProfileTab;
  inboxCount?: number;
  onInvitationCountChange?: (count: number) => void;
}

export function ProfileModalView({
  services,
  currentUser,
  show,
  onHide,
  initialTab = "profile",
  inboxCount,
  onInvitationCountChange,
}: ProfileModalViewProps) {
  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    if (show) {
      setTab(initialTab);
    }
  }, [show, initialTab]);

  const [invitations, setInvitations] = useState<
    WithId<UserProjectInvitationDoc>[]
  >([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [reviewRequests, setReviewRequests] = useState<ScoreReviewRequest[] | null>(null);
  const [reviewError, setReviewError] = useState(false);

  useEffect(() => {
    setReviewRequests(null);
    setReviewError(false);
    if (!show || !currentUser || tab !== "inbox" || !services.listPendingScoreReviewRequests) { return; }
    let active = true;
    void services.listPendingScoreReviewRequests(currentUser.uid).then(
      (reviews) => { if (active) { setReviewRequests(reviews); } },
      () => { if (active) { setReviewError(true); } },
    );
    return () => { active = false; };
  }, [show, currentUser, tab, services]);

  useEffect(() => {
    if (!currentUser || tab !== "inbox") {
      return;
    }
    setInboxLoading(true);
    void services
      .getPendingUserProjectInvitations(currentUser.uid)
      .then((invs) => {
        setInvitations(invs);
        setInboxLoading(false);
      });
  }, [currentUser, tab, services]);

  // Invitations are keyed by invitee, so within one user's inbox the project
  // is what tells them apart.
  const respond = async (
    inv: UserProjectInvitationDoc,
    action: (inv: UserProjectInvitationDoc) => Promise<void>,
  ) => {
    setRespondingTo(inv.projectId);
    try {
      await action(inv);
      const updated = invitations.filter((i) => i.projectId !== inv.projectId);
      setInvitations(updated);
      onInvitationCountChange?.(updated.length);
    } finally {
      setRespondingTo(null);
    }
  };

  const handleAccept = (inv: UserProjectInvitationDoc) =>
    respond(inv, (i) =>
      services.acceptUserProjectInvitation(i, displayNameOf(currentUser!)),
    );

  const handleDeny = (inv: UserProjectInvitationDoc) =>
    respond(inv, (i) =>
      services.denyUserProjectInvitation(i.projectId, i.toUserId),
    );

  const [displayName, setDisplayName] = useState(
    currentUser?.displayName ?? "",
  );
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profilePending, setProfilePending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfilePending(true);
    try {
      await services.updateDisplayName(displayName);
      setProfileSuccess("Nome atualizado!");
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : "Erro ao atualizar nome",
      );
    } finally {
      setProfilePending(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setProfileError("");
    setProfileSuccess("");
    setProfilePending(true);
    try {
      const blob = await resizeImage(file);
      await services.updateAvatar(blob);
      setProfileSuccess("Avatar atualizado!");
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : "Erro ao atualizar avatar",
      );
    } finally {
      setProfilePending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setPasswordPending(true);
    try {
      await services.changePassword(currentPassword, newPassword);
      setPasswordSuccess("Senha atualizada!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordError(
        describeAuthError(err),
      );
    } finally {
      setPasswordPending(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Perfil</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          activeKey={tab}
          onSelect={(k) => {
            setTab(k ?? "profile");
            setProfileError("");
            setProfileSuccess("");
            setPasswordError("");
            setPasswordSuccess("");
          }}
          className="mb-3"
        >
          <Tab eventKey="profile" title="Editar perfil">
            <div className="d-flex flex-column align-items-center mb-3">
              <div className="brand-avatar">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" />
                ) : (
                  currentUser && initialsOf(currentUser)
                )}
              </div>
              <Button
                type="button"
                variant="text" className="mt-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={profilePending}
              >
                Alterar foto
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="d-none"
                onChange={(e) => void handleAvatarChange(e)}
              />
            </div>
            <form onSubmit={(e) => void handleSaveDisplayName(e)}>
              <div className="mb-3">
                <label className="form-label" htmlFor="profile-email">Email</label>
                <Input
                  id="profile-email"
                  type="email"
                  value={currentUser?.email ?? ""}
                  readOnly
                  disabled
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="profile-name">Nome</label>
                <Input
                  id="profile-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"

                disabled={profilePending}
              >
                Salvar
              </Button>
            </form>
            {profileSuccess && (
              <div className="alert alert-success mt-3">{profileSuccess}</div>
            )}
            {profileError && (
              <div className="alert alert-danger mt-3">{profileError}</div>
            )}
          </Tab>
          <Tab
            eventKey="inbox"
            title={inboxCount ? `Caixa de entrada (${inboxCount})` : "Caixa de entrada"}
          >
            {inboxLoading ? (
              <Spinner animation="border" size="sm" />
            ) : invitations.length === 0 ? (
              <p className="mb-0">Nenhum convite pendente.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {invitations.map((inv) => (
                  <div key={inv.projectId} className="brand-card">
                    <p className="mb-3">
                      <strong>{inv.fromDisplayName}</strong> convidou você para{" "}
                      <strong>{inv.projectTitle}</strong> como{" "}
                      <strong>{inv.role}</strong>
                    </p>
                    <div className="d-flex gap-2">
                      <Button
                        variant="primary"
                        disabled={respondingTo === inv.projectId}
                        onClick={() => void handleAccept(inv)}
                      >
                        Aceitar
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={respondingTo === inv.projectId}
                        onClick={() => void handleDeny(inv)}
                      >
                        Recusar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {services.listPendingScoreReviewRequests && (
              <section className="mt-3" aria-label="Solicitações de revisão">
                <h3 className="h5">Solicitações de revisão</h3>
                {reviewError ? <p role="alert">Não foi possível carregar as revisões.</p> :
                  reviewRequests === null ? <p role="status">Carregando revisões…</p> :
                  reviewRequests.length === 0 ? <p>Nenhuma revisão pendente.</p> : (
                    <ul>
                      {reviewRequests.map((request) => (
                        <li key={`${request.projectId}/${request.id}`}>
                          <Link size="sm" to={scoreRevisionPath(request.scoreId, request.revisionId)} onClick={onHide}>
                            Revisar partitura: {request.scoreId}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            )}
          </Tab>
          <Tab eventKey="password" title="Alterar senha">
            <form onSubmit={(e) => void handleChangePassword(e)}>
              <div className="mb-3">
                <Input
                  placeholder="Senha atual"
                  aria-label="Senha atual"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <Input
                  placeholder="Nova senha"
                  aria-label="Nova senha"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <Input
                  placeholder="Confirmar nova senha"
                  aria-label="Confirmar nova senha"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"

                disabled={passwordPending}
              >
                Alterar senha
              </Button>
            </form>
            {passwordSuccess && (
              <div className="alert alert-success mt-3">{passwordSuccess}</div>
            )}
            {passwordError && (
              <div className="alert alert-danger mt-3">{passwordError}</div>
            )}
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={() => void services.logout()}
        >
          Sair
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
