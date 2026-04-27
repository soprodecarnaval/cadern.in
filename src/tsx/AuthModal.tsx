import { useEffect, useRef, useState } from "react";
import { Modal, Tab, Tabs } from "react-bootstrap";
import { useAuth } from "../auth";

interface AuthModalProps {
  show: boolean;
  onHide: () => void;
}

export function AuthModal({ show, onHide }: AuthModalProps) {
  const { login, register, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tab, setTab] = useState<string>("login");

  useEffect(() => {
    return () => {
      if (countdownRef.current) {clearInterval(countdownRef.current);}
    };
  }, []);

  const handleHide = () => {
    setError("");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setResetSent(false);
    setResetCountdown(0);
    if (countdownRef.current) {clearInterval(countdownRef.current);}
    onHide();
  };

  const startCountdown = () => {
    setResetCountdown(90);
    countdownRef.current = setInterval(() => {
      setResetCountdown((n) => {
        if (n <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Digite seu email para recuperar a senha.");
      return;
    }
    setError("");
    setResetPending(true);
    try {
      await resetPassword(email);
      setResetSent(true);
      startCountdown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setResetPending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      handleHide();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(email, password, displayName);
      handleHide();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta");
    }
  };

  return (
    <Modal show={show} onHide={handleHide}>
      <Modal.Header closeButton>
        <Modal.Title>Conta</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          activeKey={tab}
          onSelect={(k) => {
            setTab(k ?? "login");
            setError("");
          }}
          className="mb-3"
        >
          <Tab eventKey="login" title="Entrar">
            <form onSubmit={(val) => void handleLogin(val)}>
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
              <div className="d-flex align-items-center gap-3">
                <button type="submit" className="btn btn-primary">
                  Entrar
                </button>
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => void handleResetPassword()}
                  disabled={resetPending || resetCountdown > 0}
                >
                  {resetCountdown > 0
                    ? `Esqueci a senha (${resetCountdown}s)`
                    : "Esqueci a senha"}
                </button>
              </div>
              {resetSent && (
                <div className="alert alert-success mt-3" role="alert">
                  Email de recuperação enviado!
                </div>
              )}
            </form>
          </Tab>
          <Tab eventKey="register" title="Criar conta">
            <form onSubmit={(val) => void handleRegister(val)}>
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
              <button type="submit" className="btn btn-primary">
                Criar conta
              </button>
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
