import { useMemo, useState, type ChangeEvent } from "react";
import {
  Button,
  Form,
  ListGroup,
  OverlayTrigger,
  Spinner,
  Tooltip,
} from "react-bootstrap";
import type { Instrument } from "../../types/instrument";
import type {
  NumberedSongbookItemViewModel,
  NumberedSongbookScoreViewModel,
} from "../../types/viewModels";
import type { SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import { useAuth } from "../auth";
import type { WithId } from "../lib/db";
import { isSongbookSection } from "../lib/songbook";
import {
  buildSongbookSections,
  computeInstrumentStats,
  instrumentFallbacks,
} from "../lib/pdfGeneration";
import { generateSongbookPdfs } from "../lib/generateSongbookPdfs";
import { COVER_TYPES, saveSongbookCovers } from "../lib/songbookCovers";

const CarnivalModeTooltip = (
  <Tooltip id="carnival-tooltip">
    Usa a capa do carnaval 2026 e formatação especial do índice
  </Tooltip>
);

const BackPageTooltip = (
  <Tooltip id="back-tooltip">
    Adiciona uma página com o número da música no verso de cada partitura
  </Tooltip>
);

const AntiAssedioTooltip = (
  <Tooltip id="anti-assedio-tooltip">
    Inclui 4 páginas da cartilha anti-assédio após o índice
  </Tooltip>
);

const HelpIcon = ({ tooltip }: { tooltip: JSX.Element }) => (
  <OverlayTrigger placement="right" overlay={tooltip}>
    <span style={{ cursor: "help", marginLeft: "0.5rem", color: "#6c757d" }}>
      ?
    </span>
  </OverlayTrigger>
);

/**
 * Project songbook's PDF generation: inline, no title field (uses
 * songbook.title) and no modal — merges PdfGenerator's instrument picker
 * with per-instrument cover editing (SongbookCoversEditor's old job).
 * Generation stays available to any viewer on any version, matching today's
 * unconditional PDFGenerator; `canEditCovers` only gates the cover actions,
 * same as today's "Capas" button (editor role + current version).
 */
export function SongbookGenerationPanel({
  songbook,
  revision,
  items,
  canEditCovers,
  onCoversSaved,
}: {
  songbook: WithId<SongbookDoc>;
  revision: SongbookRevisionDoc;
  items: NumberedSongbookItemViewModel[];
  canEditCovers: boolean;
  onCoversSaved: () => void;
}) {
  const { currentUser } = useAuth();
  const scores = items.filter(
    (i): i is NumberedSongbookScoreViewModel =>
      !isSongbookSection(i) && !i.deleted,
  );
  const instrumentStats = useMemo(() => computeInstrumentStats(scores), [scores]);

  const [included, setIncluded] = useState<Set<Instrument>>(
    () => new Set(instrumentStats.stats.map((s) => s.instrument)),
  );
  const [enabledFallbacks, setEnabledFallbacks] = useState<Set<Instrument>>(new Set());
  const [carnivalMode, setCarnivalMode] = useState(false);
  const [backSheetPageNumber, setBackSheetPageNumber] = useState(false);
  const [antiAssedioPages, setAntiAssedioPages] = useState(false);
  const [debugBoundingBoxes, setDebugBoundingBoxes] = useState(false);

  const [addedCovers, setAddedCovers] = useState<Map<Instrument, File>>(new Map());
  const [removedCovers, setRemovedCovers] = useState<Set<Instrument>>(new Set());
  const [savingCovers, setSavingCovers] = useState(false);
  const [coversError, setCoversError] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentInstrument, setCurrentInstrument] = useState<Instrument | null>(null);
  const [completedInstruments, setCompletedInstruments] = useState<Set<Instrument>>(new Set());

  const toggleIncluded = (instrument: Instrument) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      next.has(instrument) ? next.delete(instrument) : next.add(instrument);
      return next;
    });

  const setCover = (instrument: Instrument, file: File | null) => {
    setAddedCovers((prev) => {
      const next = new Map(prev);
      if (file) {
        next.set(instrument, file);
      } else {
        next.delete(instrument);
      }
      return next;
    });
    setRemovedCovers((prev) => {
      const next = new Set(prev);
      if (file) {
        next.delete(instrument);
      }
      return next;
    });
  };

  const removeCover = (instrument: Instrument) => {
    setAddedCovers((prev) => {
      const next = new Map(prev);
      next.delete(instrument);
      return next;
    });
    setRemovedCovers((prev) => new Set(prev).add(instrument));
  };

  const coverUrl = (instrument: Instrument): string | undefined => {
    const added = addedCovers.get(instrument);
    if (added) { return URL.createObjectURL(added); }
    if (removedCovers.has(instrument)) { return undefined; }
    return revision.covers[instrument]?.url;
  };

  const handleSaveCovers = async () => {
    if (!currentUser) { return; }
    setSavingCovers(true);
    setCoversError("");
    try {
      await saveSongbookCovers({
        songbook,
        current: revision,
        added: addedCovers,
        removed: [...removedCovers],
        user: currentUser,
      });
      setAddedCovers(new Map());
      setRemovedCovers(new Set());
      onCoversSaved();
    } catch (err: unknown) {
      setCoversError(err instanceof Error ? err.message : "Erro ao salvar capas");
    } finally {
      setSavingCovers(false);
    }
  };

  const handleGenerate = async () => {
    if (included.size === 0) {
      alert("Selecione ao menos um instrumento!");
      return;
    }
    setIsGenerating(true);
    setGenerationProgress(0);
    setCompletedInstruments(new Set());
    setCurrentInstrument(null);
    try {
      const sections = buildSongbookSections(items);
      const instruments = Array.from(included);
      const covers = Object.fromEntries(
        instruments.map((i) => [i, coverUrl(i) ?? ""]),
      );
      await generateSongbookPdfs({
        sections,
        instruments,
        title: songbook.title,
        covers,
        fallbackInstruments: enabledFallbacks,
        carnivalMode,
        backSheetPageNumber,
        antiAssedioPages,
        debugBoundingBoxes,
        onStart: setCurrentInstrument,
        onComplete: (instrument, index, total) => {
          setCompletedInstruments((prev) => new Set(prev).add(instrument));
          setGenerationProgress(((index + 1) / total) * 100);
        },
      });
    } catch (error) {
      console.error("Error generating PDFs:", error);
      alert("Ocorreu um erro ao gerar os PDFs. Por favor, tente novamente.");
    } finally {
      setIsGenerating(false);
      setCurrentInstrument(null);
    }
  };

  return (
    <section className="mt-4">
      <h5>Gerar caderninhos</h5>
      <ListGroup>
        {instrumentStats.stats.map(({ instrument, count, countWithFallback }) => {
          const isIncluded = included.has(instrument);
          const isCompleted = completedInstruments.has(instrument);
          const isCurrent = currentInstrument === instrument;
          const isGreyedOut = isGenerating && !isIncluded;
          const hasCover = !!coverUrl(instrument);
          const fallback = instrumentFallbacks[instrument];
          const hasFallback = fallback && countWithFallback && countWithFallback > count;
          const fallbackEnabled = enabledFallbacks.has(instrument);
          const displayCount = fallbackEnabled && countWithFallback ? countWithFallback : count;

          return (
            <div key={instrument}>
              <ListGroup.Item
                onClick={() => !isGenerating && toggleIncluded(instrument)}
                className="d-flex align-items-center"
                style={{ cursor: isGenerating ? "default" : "pointer", opacity: isGreyedOut ? 0.4 : 1 }}
              >
                <span className="me-3" style={{ width: "1.25rem", display: "inline-flex", justifyContent: "center" }}>
                  {!isGenerating ? (
                    <Form.Check
                      type="checkbox"
                      checked={isIncluded}
                      onChange={() => toggleIncluded(instrument)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : isIncluded ? (
                    isCompleted ? "✅" : isCurrent ? <Spinner animation="border" size="sm" variant="primary" /> : null
                  ) : null}
                </span>
                <span className="flex-grow-1">{instrument.toUpperCase()}</span>
                <span className="text-muted me-2">({displayCount}/{instrumentStats.totalScores})</span>
                {!isGenerating && canEditCovers && (
                  <>
                    <Form.Label
                      htmlFor={`cover-${instrument}`}
                      className={`btn btn-sm ${hasCover ? "btn-success" : "btn-outline-secondary"} mb-0`}
                      style={{ cursor: "pointer", fontSize: "0.75rem" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hasCover ? "✓ Trocar capa" : "Capa"}
                    </Form.Label>
                    <Form.Control
                      id={`cover-${instrument}`}
                      type="file"
                      hidden
                      accept={COVER_TYPES.join(",")}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setCover(instrument, e.target.files?.[0] ?? null)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                    {hasCover && (
                      <Button
                        size="sm"
                        variant="link"
                        className="text-danger"
                        onClick={(e) => { e.stopPropagation(); removeCover(instrument); }}
                      >
                        remover
                      </Button>
                    )}
                  </>
                )}
                {!isGenerating && !canEditCovers && hasCover && (
                  <span className="text-success small">✓ Capa</span>
                )}
              </ListGroup.Item>
              {!isGenerating && isIncluded && hasFallback && (
                <ListGroup.Item className="d-flex align-items-center ps-5" style={{ backgroundColor: "#f8f9fa", borderTop: "none" }}>
                  <Form.Check
                    type="checkbox"
                    id={`fallback-${instrument}`}
                    label={`Usar ${fallback} como fallback (+${countWithFallback - count})`}
                    checked={fallbackEnabled}
                    onChange={() => setEnabledFallbacks((prev) => {
                      const next = new Set(prev);
                      next.has(instrument) ? next.delete(instrument) : next.add(instrument);
                      return next;
                    })}
                  />
                </ListGroup.Item>
              )}
            </div>
          );
        })}
      </ListGroup>
      {instrumentStats.stats.length === 0 && (
        <p className="text-muted text-center">Nenhum instrumento disponível nas músicas deste caderninho.</p>
      )}
      {isGenerating && (
        <div className="progress mt-3">
          <div className="progress-bar" role="progressbar" style={{ width: `${generationProgress}%` }}
            aria-valuenow={generationProgress} aria-valuemin={0} aria-valuemax={100}>
            {Math.round(generationProgress)}%
          </div>
        </div>
      )}
      {!isGenerating && (
        <div className="mt-3">
          <div className="d-flex align-items-center">
            <Form.Check type="switch" id="carnival-mode" label="Capa e índice do carnaval"
              checked={carnivalMode} onChange={(e) => setCarnivalMode(e.target.checked)} />
            <HelpIcon tooltip={CarnivalModeTooltip} />
          </div>
          <div className="d-flex align-items-center">
            <Form.Check type="switch" id="back-number" label="Página de número no verso"
              checked={backSheetPageNumber} onChange={(e) => setBackSheetPageNumber(e.target.checked)} />
            <HelpIcon tooltip={BackPageTooltip} />
          </div>
          <div className="d-flex align-items-center">
            <Form.Check type="switch" id="anti-assedio" label="Cartilha anti-assédio"
              checked={antiAssedioPages} onChange={(e) => setAntiAssedioPages(e.target.checked)} />
            <HelpIcon tooltip={AntiAssedioTooltip} />
          </div>
          {import.meta.env.DEV && (
            <Form.Check type="switch" id="debug-boxes" label="Debug"
              checked={debugBoundingBoxes} onChange={(e) => setDebugBoundingBoxes(e.target.checked)} />
          )}
        </div>
      )}
      <div className="d-flex gap-2 mt-3">
        {canEditCovers && (
          <Button
            variant="outline-primary"
            disabled={savingCovers || (addedCovers.size === 0 && removedCovers.size === 0)}
            onClick={() => void handleSaveCovers()}
          >
            {savingCovers ? <Spinner animation="border" size="sm" /> : "Salvar capas"}
          </Button>
        )}
        <Button
          variant="primary"
          disabled={isGenerating || included.size === 0}
          onClick={() => void handleGenerate()}
        >
          {isGenerating ? "Gerando..." : `Gerar ${included.size} caderninho${included.size !== 1 ? "s" : ""}`}
        </Button>
      </div>
      {coversError && <div className="text-danger mt-2">{coversError}</div>}
    </section>
  );
}
