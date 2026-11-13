import { useState, type FormEvent } from "react";
import { GoogleLinkRequiredError, useAuth } from "../../auth";
import { describeAuthError } from "../authMessages";

// Signals the user closed the OAuth popup without finishing; distinct from a
// Firebase error so it gets its own message instead of a generic one.
class OAuthPopupClosedError extends Error {}

export function LoginForm() {
  const { login, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const [linkRequest, setLinkRequest] = useState<GoogleLinkRequiredError | null>(
    null,
  );
  const [linkPassword, setLinkPassword] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitGoogle = async () => {
    setError("");
    setGoogleSubmitting(true);
    // signInWithPopup never settles if the user closes the popup without
    // finishing — Electron doesn't propagate that back to Firebase's own
    // detection, so main.ts tells us directly and we unstick the UI here.
    let unsubscribe: (() => void) | undefined;
    const popupClosed = new Promise<never>((_resolve, reject) => {
      unsubscribe = window.api.onOAuthPopupClosed(() => {
        reject(new OAuthPopupClosedError());
      });
    });
    try {
      await Promise.race([signInWithGoogle(), popupClosed]);
    } catch (e) {
      if (e instanceof GoogleLinkRequiredError) {
        setLinkRequest(e);
      } else if (e instanceof OAuthPopupClosedError) {
        setError("Login cancelado.");
      } else {
        setError(describeAuthError(e));
      }
    } finally {
      unsubscribe?.();
      setGoogleSubmitting(false);
    }
  };

  const submitLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!linkRequest) {
      return;
    }
    setLinkError("");
    setLinkSubmitting(true);
    try {
      await linkRequest.link(linkPassword);
      setLinkRequest(null);
      setLinkPassword("");
    } catch (e) {
      setLinkError(describeAuthError(e));
    } finally {
      setLinkSubmitting(false);
    }
  };

  if (linkRequest) {
    return (
      <form className="login-form" onSubmit={(e) => void submitLink(e)}>
        <h2>Conectar conta Google</h2>
        <p>{linkRequest.message}</p>
        <label>
          <span>Senha</span>
          <input
            type="password"
            value={linkPassword}
            autoFocus
            required
            onChange={(e) => setLinkPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={linkSubmitting || !linkPassword}>
          {linkSubmitting ? "Conectando…" : "Conectar"}
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setLinkRequest(null);
            setLinkPassword("");
            setLinkError("");
          }}
        >
          Cancelar
        </button>
        {linkError && <p className="error">{linkError}</p>}
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={(e) => void submit(e)}>
      <h2>Entrar no cadern.in</h2>
      <label>
        <span>E-mail</span>
        <input
          type="email"
          value={email}
          autoFocus
          required
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        <span>Senha</span>
        <input
          type="password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button type="submit" disabled={submitting || !email || !password}>
        {submitting ? "Entrando…" : "Entrar"}
      </button>
      <button
        type="button"
        onClick={() => void submitGoogle()}
        disabled={googleSubmitting}
      >
        {googleSubmitting ? "Entrando…" : "Entrar com Google"}
      </button>
      {error && <p className="error">{error}</p>}
      <small>
        Ainda não tem conta? Crie uma em cadern.in — é a mesma conta do site.
      </small>
    </form>
  );
}
