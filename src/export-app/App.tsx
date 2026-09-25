import { useEffect, useState } from "react";
import type { ScorePart } from "../../scripts/lib/scoreMeta";
import type { ExportResult } from "../../scripts/lib/exportScore";
import type { ExportFailure } from "../../scripts/lib/exportError";
import { translateWarning } from "../lib/warningMessages";
import type { User } from "firebase/auth";
import { useAuth } from "../auth";
import { LoginForm } from "./components/LoginForm";
import { UploadPanel } from "./components/UploadPanel";
import { FileDrop } from "./components/FileDrop";
import {
  MetadataForm,
  type MetadataValues,
} from "./components/MetadataForm";
import { PartsTable } from "./components/PartsTable";

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
  const { currentUser, logout } = useAuth();

  // Login gates the whole app: uploading is the point of it, and a session
  // established up front is one less interruption mid-export.
  if (!currentUser) {
    return (
      <main className="app app--login">
        <h1>cadern.in — Exportador</h1>
        <LoginForm />
      </main>
    );
  }

  return (
    <ExportApp
      onLogout={() => void logout()}
      user={currentUser}
    />
  );
}

function ExportApp({
  onLogout,
  user,
}: {
  onLogout: () => void;
  user: User;
}) {
  const [mscorePath, setMscorePath] = useState<string | null>(null);
  const [resolvingMscore, setResolvingMscore] = useState(true);
  const [msczPath, setMsczPath] = useState("");
  const [parts, setParts] = useState<ScorePart[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [metadata, setMetadata] = useState<MetadataValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
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
    setExportResult(null);
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

  const runExport = async () => {
    if (!metadata) {
      return;
    }
    setError("");
    setExportResult(null);
    const destinationDirectory = await window.api.pickExportDirectory();
    if (!destinationDirectory) {
      return;
    }

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

    const attempt = async (overwrite: boolean) => {
      setExporting(true);
      try {
        return await window.api.runExport({
          msczPath,
          title: metadata.title,
          selectedParts,
          metadata,
          destinationDirectory,
          overwrite,
        });
      } finally {
        setExporting(false);
      }
    };

    let outcome = await attempt(false);

    // A destination that already holds a previous export is a question, not a
    // failure: exporting, spotting a typo and re-exporting is a normal loop.
    if (!outcome.ok && outcome.code === "EXPORT_DESTINATION_NOT_EMPTY") {
      const files = (outcome.meta.files as string[] | undefined) ?? [];
      const confirmed = window.confirm(
        `A pasta de destino já tem ${files.length} arquivo(s) exportados` +
          `:\n\n${files.join("\n")}\n\nSubstituir?`,
      );
      if (!confirmed) {
        return;
      }
      outcome = await attempt(true);
    }

    if (outcome.ok) {
      setExportResult(outcome.value);
    } else {
      setError(describeFailure(outcome));
    }
  };

  return (
    <main className="app">
      <header className="session">
        <h1>cadern.in — Exportador</h1>
        <span className="session-user">
          {user.email}
          <button type="button" className="link" onClick={onLogout}>
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
        <button className="btn-link" onClick={() => void locate()}>
          Localizar…
        </button>
      </section>

      <FileDrop
        onPick={(path) => void loadScore(path)}
        disabled={!mscorePath || loading}
      />

      {!resolvingMscore && !mscorePath && (
        <p className="muted">
          Localize o MuseScore 4 para selecionar uma partitura.
        </p>
      )}
      {loading && <p className="muted">Lendo partitura…</p>}
      {error && <p className="error">{error}</p>}

      {metadata && (
        <>
          <header className="score-head">
            <strong>{msczPath.split(/[\\/]/).pop()}</strong>
            <button
              className="btn-link"
              onClick={() => {
                setMsczPath("");
                setParts([]);
                setSelected(new Set());
                setMetadata(null);
                setExportResult(null);
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
            onChange={(value) => {
              setMetadata(value);
              setExportResult(null);
            }}
          />
          <section className="export-actions">
            <button
              className="btn-primary"
              disabled={selected.size === 0 || exporting}
              onClick={() => void runExport()}
            >
              {exporting ? "Exportando…" : "Exportar…"}
            </button>
            {selected.size === 0 && (
              <span className="muted">Selecione pelo menos uma parte.</span>
            )}
          </section>
          {exportResult && (
            <section className="export-result">
              <strong>Partitura exportada com sucesso</strong>
              <span>{exportResult.files.length} arquivos criados.</span>
              <button
                onClick={() =>
                  void window.api.openFolder(exportResult.directory)
                }
              >
                Abrir pasta
              </button>
            </section>
          )}

          {exportResult && (
            <UploadPanel user={user} directory={exportResult.directory} />
          )}
        </>
      )}
    </main>
  );
}
