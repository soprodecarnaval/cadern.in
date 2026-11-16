import { useEffect, useState } from "react";
import type { ScorePart } from "../../scripts/lib/scoreMeta";
import type { ExportResult } from "../../scripts/lib/exportScore";
import type { ExportFailure } from "../../scripts/lib/exportError";
import { translateWarning } from "../lib/warningMessages";
import type { User } from "firebase/auth";
import { useAuth } from "../auth";
import { describeAuthError } from "../lib/authMessages";
import type { ExportDeepLinkContext } from "../../types/exportDeepLink";
import { LoginForm } from "./components/LoginForm";
import { UploadPanel } from "./components/UploadPanel";
import { FileDrop } from "./components/FileDrop";
import {
  MetadataForm,
  type MetadataValues,
} from "./components/MetadataForm";
import { PartsTable } from "./components/PartsTable";

/**
 * The exporter has no destination picker of its own (010): every launch
 * must come from a cadernin-export:// link, cold (process argv) or warm
 * (second-instance / macOS open-url). Held above the login gate so a
 * cold-launch link survives signing in.
 */
function useExportContext(): ExportDeepLinkContext | null {
  const [context, setContext] = useState<ExportDeepLinkContext | null>(null);
  useEffect(() => {
    void window.api.getExportContext().then((pending) => {
      if (pending) {
        setContext(pending);
      }
    });
    return window.api.onExportContext(setContext);
  }, []);
  return context;
}

/** Library messages are English by policy; the UI is pt-BR. */
function describeFailure(failure: ExportFailure): string {
  return translateWarning(failure.code, {
    ...failure.meta,
    message: failure.message,
    files: Array.isArray(failure.meta.files)
      ? failure.meta.files.join(", ")
      : failure.meta.files,
    missing: Array.isArray(failure.meta.missing)
      ? failure.meta.missing.join(", ")
      : failure.meta.missing,
  });
}

export function App() {
  const { currentUser, pendingUser, logout, resendVerificationEmail } =
    useAuth();
  const context = useExportContext();

  // Login gates the whole app: uploading is the point of it, and a session
  // established up front is one less interruption mid-export. An unverified
  // user is not considered logged in, same as the website.
  if (pendingUser) {
    return (
      <main className="app app--login">
        <h1>cadern.in — Exportador</h1>
        <PendingVerification
          email={pendingUser.email}
          onResend={() => resendVerificationEmail()}
          onLogout={() => void logout()}
        />
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="app app--login">
        <h1>cadern.in — Exportador</h1>
        <LoginForm />
      </main>
    );
  }

  if (!context) {
    return (
      <main className="app app--login">
        <h1>cadern.in — Exportador</h1>
        <NoContext onLogout={() => void logout()} />
      </main>
    );
  }

  return (
    <ExportApp
      onLogout={() => void logout()}
      user={currentUser}
      context={context}
    />
  );
}

/**
 * No deep link, no destination — not even an option to proceed (010): opens
 * from a project page or a songbook-scoped score page on the website, never
 * from inside the exporter itself.
 */
function NoContext({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="login-form">
      <h2>Nenhum destino selecionado</h2>
      <p>
        Abra o Exportador a partir da página de um projeto ou de uma
        partitura em um caderninho no site do cadern.in — o botão “Enviar
        partitura” abre este app já sabendo para onde enviar.
      </p>
      <button type="button" className="btn-link" onClick={onLogout}>
        Usar outra conta
      </button>
    </div>
  );
}

function PendingVerification({
  email,
  onResend,
  onLogout,
}: {
  email: string | null;
  onResend: () => Promise<void>;
  onLogout: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const resend = async () => {
    setError("");
    try {
      await onResend();
      setSent(true);
    } catch (e) {
      setError(describeAuthError(e));
    }
  };

  return (
    <div className="login-form">
      <h2>Verifique seu e-mail</h2>
      <p>
        Enviamos um link de confirmação para <strong>{email}</strong>. Clique
        no link, depois reabra o app.
      </p>
      <button type="button" onClick={() => void resend()}>
        Reenviar e-mail
      </button>
      <button type="button" className="btn-link" onClick={onLogout}>
        Usar outra conta
      </button>
      {sent && <p className="muted">Email reenviado!</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ExportApp({
  onLogout,
  user,
  context,
}: {
  onLogout: () => void;
  user: User;
  context: ExportDeepLinkContext;
}) {
  const [mscorePath, setMscorePath] = useState<string | null>(null);
  const [resolvingMscore, setResolvingMscore] = useState(true);
  const [msczPath, setMsczPath] = useState("");
  const [parts, setParts] = useState<ScorePart[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [metadata, setMetadata] = useState<MetadataValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void window.api
      .getMscorePath()
      .then(setMscorePath)
      .finally(() => setResolvingMscore(false));
  }, []);

  const locate = async () => {
    setError("");
    const res = await window.api.locateMscore();
    if (res && res.ok && res.path) {
      setMscorePath(res.path);
    } else if (res && !res.ok) {
      setError(res.error ?? "Invalid binary");
    }
  };

  const loadScore = async (path: string) => {
    setError("");
    setMsczPath(path);
    setParts([]);
    setSelected(new Set());
    setMetadata(null);
    setLoading(true);
    try {
      const result = await window.api.readScoreMeta(path);
      setParts(result.parts);
      setSelected(
        new Set(
          result.parts
            .filter((part) => part.instrument)
            .map((part) => part.id),
        ),
      );
      setMetadata({
        title: result.title,
        composer: result.composer,
        previousSource: result.previousSource,
        poet: result.poet,
      });
      if (result.parts.length === 0) {
        setError("Nenhuma parte encontrada.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const togglePart = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const runExport = async (): Promise<ExportResult> => {
    if (!metadata) {
      throw new Error("Selecione uma partitura.");
    }
    setError("");
    const selectedParts = parts.flatMap((part, scoreIndex) =>
      selected.has(part.id) && part.instrument
        ? [{
            id: part.id,
            name: part.name,
            scoreIndex,
            instrument: part.instrument,
          }]
        : [],
    );

    const outcome = await window.api.runExport({
      msczPath,
      title: metadata.title,
      selectedParts,
      metadata,
    });
    if (!outcome.ok) {
      throw new Error(describeFailure(outcome));
    }
    return outcome.value;
  };

  return (
    <main className="app">
      <header className="session">
        <h1>cadern.in — Exportador</h1>
        <span className="session-user">
          {user.email}
          <button type="button" className="link" disabled={exporting} onClick={onLogout}>
            Sair
          </button>
        </span>
      </header>

      <section className="row mscore-bar">
        <strong>MuseScore 4:</strong>
        {resolvingMscore ? (
          <span className="muted">procurando…</span>
        ) : mscorePath ? (
          <code>{mscorePath}</code>
        ) : (
          <span className="danger">não encontrado</span>
        )}
        <button className="btn-link" disabled={exporting} onClick={() => void locate()}>
          Localizar…
        </button>
      </section>

      <FileDrop
        onPick={(path) => void loadScore(path)}
        disabled={!mscorePath || loading || exporting}
      />

      {!resolvingMscore && !mscorePath && (
        <p className="muted">
          Localize o MuseScore 4 para selecionar uma partitura. {" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => void window.api.openMuseScoreDownload()}
          >
            Baixar MuseScore Studio
          </button>
        </p>
      )}
      {loading && <p className="muted">Lendo partitura…</p>}
      {error && <p className="error">{error}</p>}

      {metadata && (
        <fieldset className="score-editor" disabled={exporting}>
          <header className="score-head">
            <strong>{msczPath.split(/[\\/]/).pop()}</strong>
            <button
              className="btn-link"
              onClick={() => {
                setMsczPath("");
                setParts([]);
                setSelected(new Set());
                setMetadata(null);
                setError("");
              }}
            >
              Trocar
            </button>
          </header>
          {parts.length > 0 && (
            <PartsTable
              parts={parts}
              selected={selected}
              onToggle={togglePart}
            />
          )}
          <MetadataForm
            value={metadata}
            onChange={setMetadata}
          />
          {selected.size === 0 && (
            <p className="muted">Selecione pelo menos uma parte.</p>
          )}
          <UploadPanel
            key={msczPath}
            user={user}
            context={context}
            msczPath={msczPath}
            exportScore={runExport}
            disabled={selected.size === 0}
            onBusyChange={setExporting}
          />
        </fieldset>
      )}
    </main>
  );
}
