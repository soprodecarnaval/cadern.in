import { useEffect, useState } from "react";
import type { ScorePart } from "../../scripts/lib/scoreMeta";
import type { ExportResult } from "../../scripts/lib/exportScore";
import { FileDrop } from "./components/FileDrop";
import {
  MetadataForm,
  type MetadataValues,
} from "./components/MetadataForm";
import { PartsTable } from "./components/PartsTable";

export function App() {
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
    setExporting(true);
    try {
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
      const result = await window.api.runExport({
        msczPath,
        title: metadata.title,
        selectedParts,
        metadata,
        destinationDirectory,
      });
      setExportResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
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
              <strong>Exportação concluída</strong>
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
        </>
      )}
    </main>
  );
}
