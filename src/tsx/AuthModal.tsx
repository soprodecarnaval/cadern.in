import { useState } from "react";
import { Modal, Tab, Tabs } from "react-bootstrap";
import { useAuth } from "../auth.js";

interface AuthModalProps {
  show: boolean;
  onHide: () => void;
}

export function AuthModal({ show, onHide }: AuthModalProps) {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<string>("login");

  const handleHide = () => {
    setError("");
    setEmail("");
    setPassword("");
    setDisplayName("");
    onHide();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      handleHide();
    } catch (err: any) {
      setError(err.message ?? "Erro ao entrar");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(email, password, displayName);
      handleHide();
    } catch (err: any) {
      setError(err.message ?? "Erro ao criar conta");
    }
  };

  return (
    <Modal show={show} onHide={handleHide}>
      <Modal.Header closeButton>
        <Modal.Title>Conta</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs activeKey={tab} onSelect={(k) => { setTab(k ?? "login"); setError(""); }} className="mb-3">
          <Tab eventKey="login" title="Entrar">
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Senha</label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">Entrar</button>
            </form>
          </Tab>
          <Tab eventKey="register" title="Criar conta">
            <form onSubmit={handleRegister}>
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
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Senha</label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">Criar conta</button>
            </form>
          </Tab>
        </Tabs>
        {error && (
          <div className="alert alert-danger mt-2" role="alert">
            {error}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
