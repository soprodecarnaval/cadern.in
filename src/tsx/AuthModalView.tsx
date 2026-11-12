import { useEffect, useRef, useState } from "react";
import { Modal, Tab, Tabs } from "react-bootstrap";
import type { User } from "firebase/auth";
import { GoogleLinkRequiredError } from "../auth";

export interface AuthModalViewProps {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  pendingUser: User | null;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  show: boolean;
  onHide: () => void;
}

export function AuthModalView({
  show,
  onHide,
  login,
  register,
  resetPassword,
  pendingUser,
  resendVerificationEmail,
  refreshVerificationStatus,
  signInWithGoogle,
  logout,
}: AuthModalViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tab, setTab] = useState<string>("login");

  const [resendSent, setResendSent] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendCountdownRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [verifyError, setVerifyError] = useState("");
  const [refreshPending, setRefreshPending] = useState(false);

  const [googlePending, setGooglePending] = useState(false);
  const [linkRequest, setLinkRequest] = useState<GoogleLinkRequiredError | null>(
    null,
  );
  const [linkPassword, setLinkPassword] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (resendCountdownRef.current) {
        clearInterval(resendCountdownRef.current);
      }
    };
  }, []);

  const handleHide = () => {
    setError("");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setResetSent(false);
    setResetCountdown(0);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta");
    }
  };

  const startResendCountdown = () => {
    setResendCountdown(90);
    resendCountdownRef.current = setInterval(() => {
      setResendCountdown((n) => {
        if (n <= 1) {
          clearInterval(resendCountdownRef.current!);
          resendCountdownRef.current = null;
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  const handleResendVerification = async () => {
    setVerifyError("");
    setResendPending(true);
    try {
      await resendVerificationEmail();
      setResendSent(true);
      startResendCountdown();
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Erro ao reenviar");
    } finally {
      setResendPending(false);
    }
  };

  const handleRefreshVerification = async () => {
    setVerifyError("");
    setRefreshPending(true);
    try {
      await refreshVerificationStatus();
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Erro ao verificar");
    } finally {
      setRefreshPending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGooglePending(true);
    try {
      await signInWithGoogle();
      handleHide();
    } catch (err: unknown) {
      if (err instanceof GoogleLinkRequiredError) {
        setLinkRequest(err);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao entrar");
      }
    } finally {
      setGooglePending(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkRequest) {
      return;
    }
    setLinkError("");
    setLinkPending(true);
    try {
      await linkRequest.link(linkPassword);
      setLinkRequest(null);
      setLinkPassword("");
      handleHide();
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : "Erro ao conectar");
    } finally {
      setLinkPending(false);
    }
  };

  if (linkRequest) {
    return (
      <Modal show={show} onHide={onHide}>
        <Modal.Header closeButton>
          <Modal.Title>Conectar conta Google</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{linkRequest.message}</p>
          <form onSubmit={(val) => void handleLinkSubmit(val)}>
            <div className="mb-3">
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-control"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="d-flex align-items-center gap-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={linkPending}
              >
                Conectar
              </button>
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => {
                  setLinkRequest(null);
                  setLinkPassword("");
                  setLinkError("");
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
          {linkError && (
            <div className="alert alert-danger mt-3" role="alert">
              {linkError}
            </div>
          )}
        </Modal.Body>
      </Modal>
    );
  }

  if (pendingUser) {
    return (
      <Modal show={show} onHide={onHide}>
        <Modal.Header closeButton>
          <Modal.Title>Verifique seu email</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Enviamos um link de confirmação para{" "}
            <strong>{pendingUser.email}</strong>. Clique no link e depois
            volte aqui.
          </p>
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleRefreshVerification()}
              disabled={refreshPending}
            >
              Já verifiquei
            </button>
            <button
              type="button"
              className="btn btn-link p-0"
              onClick={() => void handleResendVerification()}
              disabled={resendPending || resendCountdown > 0}
            >
              {resendCountdown > 0
                ? `Reenviar email (${resendCountdown}s)`
                : "Reenviar email"}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-link p-0 mt-3"
            onClick={() => void logout()}
          >
            Usar outra conta
          </button>
          {resendSent && (
            <div className="alert alert-success mt-3" role="alert">
              Email reenviado!
            </div>
          )}
          {verifyError && (
            <div className="alert alert-danger mt-3" role="alert">
              {verifyError}
            </div>
          )}
        </Modal.Body>
      </Modal>
    );
  }

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
        <button
          type="button"
          className="btn btn-outline-secondary w-100 mt-2"
          onClick={() => void handleGoogleSignIn()}
          disabled={googlePending}
        >
          Continuar com Google
        </button>
        {error && (
          <div className="alert alert-danger mt-2" role="alert">
            {error}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
