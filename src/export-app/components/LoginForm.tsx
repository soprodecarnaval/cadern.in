import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth";
import { describeAuthError } from "../authMessages";

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      {error && <p className="error">{error}</p>}
      <small>
        Ainda não tem conta? Crie uma em cadern.in — é a mesma conta do site.
      </small>
    </form>
  );
}
