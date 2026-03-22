import { useRef, useState } from "react";
import { Modal, Tab, Tabs } from "react-bootstrap";
import { useAuth } from "../auth.js";
import { resizeImage } from "../utils/image.js";

interface ProfileModalProps {
  show: boolean;
  onHide: () => void;
}

export function ProfileModal({ show, onHide }: ProfileModalProps) {
  const { currentUser, updateDisplayName, updateAvatar, changePassword } = useAuth();
  const [tab, setTab] = useState("profile");

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
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
      await updateDisplayName(displayName);
      setProfileSuccess("Nome atualizado!");
    } catch (err: any) {
      setProfileError(err.message ?? "Erro ao atualizar nome");
    } finally {
      setProfilePending(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError("");
    setProfileSuccess("");
    setProfilePending(true);
    try {
      const blob = await resizeImage(file);
      await updateAvatar(blob);
      setProfileSuccess("Avatar atualizado!");
    } catch (err: any) {
      setProfileError(err.message ?? "Erro ao atualizar avatar");
    } finally {
      setProfilePending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Senha atualizada!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message ?? "Erro ao alterar senha");
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
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Avatar"
                  style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "#ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                    color: "#fff",
                  }}
                >
                  {(currentUser?.displayName?.[0] ?? "?").toUpperCase()}
                </div>
              )}
              <button
                type="button"
                className="btn btn-link btn-sm mt-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={profilePending}
              >
                Alterar foto
              </button>
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
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={currentUser?.email ?? ""}
                  readOnly
                  disabled
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  className="form-control"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={profilePending}>
                Salvar
              </button>
            </form>
            {profileSuccess && <div className="alert alert-success mt-3">{profileSuccess}</div>}
            {profileError && <div className="alert alert-danger mt-3">{profileError}</div>}
          </Tab>
          <Tab eventKey="password" title="Alterar senha">
            <form onSubmit={(e) => void handleChangePassword(e)}>
              <div className="mb-3">
                <label className="form-label">Senha atual</label>
                <input
                  type="password"
                  className="form-control"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Nova senha</label>
                <input
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Confirmar nova senha</label>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={passwordPending}>
                Alterar senha
              </button>
            </form>
            {passwordSuccess && <div className="alert alert-success mt-3">{passwordSuccess}</div>}
            {passwordError && <div className="alert alert-danger mt-3">{passwordError}</div>}
          </Tab>
        </Tabs>
      </Modal.Body>
    </Modal>
  );
}
