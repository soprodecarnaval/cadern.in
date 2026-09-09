import { useEffect, useState } from "react";
import type { ScorePart } from "../../scripts/lib/scoreMeta";
import { FileDrop } from "./components/FileDrop";
import { PartsTable } from "./components/PartsTable";

export function App() {
  const [mscorePath, setMscorePath] = useState<string | null>(null);
  const [resolvingMscore, setResolvingMscore] = useState(true);
  const [msczPath, setMsczPath] = useState("");
  const [parts, setParts] = useState<ScorePart[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    try {
      const result = await window.api.listParts(path);
      setParts(result);
      setSelected(
        new Set(result.filter((part) => part.instrument).map((part) => part.id)),
      );
      if (result.length === 0) {
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

  return (
    <main className="app">
      <h1>cadern.in — Exportador</h1>

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

      {parts.length > 0 && (
        <>
          <header className="score-head">
            <strong>{msczPath.split(/[\\/]/).pop()}</strong>
            <button
              className="btn-link"
              onClick={() => {
                setMsczPath("");
                setParts([]);
                setSelected(new Set());
                setError("");
              }}
            >
              Trocar
            </button>
          </header>
          <PartsTable
            parts={parts}
            selected={selected}
            onToggle={togglePart}
          />
        </>
      )}
    </main>
  );
}
