import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  ListGroup,
  OverlayTrigger,
  Spinner,
  Tooltip,
} from "react-bootstrap";
import type { SongbookDoc, SongbookRevisionDoc } from "../../../../../types/docs";
import type { Instrument } from "../../../../../types/instrument";
import type {
  NumberedSongbookItemViewModel,
  NumberedSongbookScoreViewModel,
} from "../../../../../types/viewModels";

import type { WithId } from "../../../../lib/db";
import {
  buildSongbookSections,
  computeInstrumentStats,
  instrumentFallbacks,
} from "../../../../lib/pdfGeneration";
import { SongbookCoverModal } from "./SongbookCoverModal";
import { isSongbookSection } from "../../../../lib/songbook";

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

export function SongbookGenerationPanelView({
  currentUser,
  generateSongbookPdfs,
  saveSongbookCovers,
  createCoverPreview,

  songbook,
  revision,
  items,
  canEditCovers,
  onCoversSaved,
}: {
  currentUser: import("firebase/auth").User | null;
  generateSongbookPdfs: typeof import("../../../../lib/generateSongbookPdfs").generateSongbookPdfs;
  saveSongbookCovers: typeof import("../../../../lib/songbookCovers").saveSongbookCovers;
  createCoverPreview: typeof import("../../../../lib/pdfPreview").createSongbookCoverPreview;

  songbook: WithId<SongbookDoc>;
  revision: SongbookRevisionDoc;
  items: NumberedSongbookItemViewModel[];
  canEditCovers: boolean;
  onCoversSaved: () => void;
}) {
  const scores = items.filter(
    (i): i is NumberedSongbookScoreViewModel =>
      !isSongbookSection(i) && !i.deleted,
  );
  const instrumentStats = useMemo(
    () => computeInstrumentStats(scores),
    [scores],
  );

  const [included, setIncluded] = useState<Set<Instrument>>(
    () => new Set(instrumentStats.stats.map((s) => s.instrument)),
  );
  const [enabledFallbacks, setEnabledFallbacks] = useState<Set<Instrument>>(
    new Set(),
  );
  const [carnivalMode, setCarnivalMode] = useState(false);
  const [backSheetPageNumber, setBackSheetPageNumber] = useState(false);
  const [antiAssedioPages, setAntiAssedioPages] = useState(false);
  const [debugBoundingBoxes, setDebugBoundingBoxes] = useState(false);

  const [coverInstrument, setCoverInstrument] = useState<Instrument | null>(null);
  const [savedCovers, setSavedCovers] = useState<SongbookRevisionDoc["covers"] | null>(null);
  const covers = savedCovers ?? revision.covers;
  useEffect(() => {
    setSavedCovers(null);
    setCoverInstrument(null);
  }, [revision]);

  const coverOptions = useMemo(() => coverInstrument ? ({
    title: songbook.title,
    instrument: coverInstrument,
    coverImageUrl: covers[coverInstrument]?.url ?? "",
    carnivalMode,
  }) : null, [coverInstrument, songbook.title, covers, carnivalMode]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentInstrument, setCurrentInstrument] = useState<Instrument | null>(
    null,
  );
  const [completedInstruments, setCompletedInstruments] = useState<
    Set<Instrument>
  >(new Set());

  const toggleIncluded = (instrument: Instrument) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      next.has(instrument) ? next.delete(instrument) : next.add(instrument);
      return next;
    });

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
      const generationCovers = Object.fromEntries(
        instruments.map((i) => [i, covers[i]?.url ?? ""]),
      );
      await generateSongbookPdfs({
        sections,
        instruments,
        title: songbook.title,
        covers: generationCovers,
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
        {instrumentStats.stats.map(
          ({ instrument, count, countWithFallback }) => {
            const isIncluded = included.has(instrument);
            const isCompleted = completedInstruments.has(instrument);
            const isCurrent = currentInstrument === instrument;
            const isGreyedOut = isGenerating && !isIncluded;
            const hasCover = !!covers[instrument]?.url;
            const fallback = instrumentFallbacks[instrument];
            const hasFallback =
              fallback && countWithFallback && countWithFallback > count;
            const fallbackEnabled = enabledFallbacks.has(instrument);
            const displayCount =
              fallbackEnabled && countWithFallback ? countWithFallback : count;

            return (
              <div key={instrument}>
                <ListGroup.Item
                  onClick={() => !isGenerating && toggleIncluded(instrument)}
                  className="d-flex align-items-center"
                  style={{
                    cursor: isGenerating ? "default" : "pointer",
                    opacity: isGreyedOut ? 0.4 : 1,
                  }}
                >
                  <span
                    className="me-3"
                    style={{
                      width: "1.25rem",
                      display: "inline-flex",
                      justifyContent: "center",
                    }}
                  >
                    {!isGenerating ? (
                      <Form.Check
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => toggleIncluded(instrument)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : isIncluded ? (
                      isCompleted ? (
                        "✅"
                      ) : isCurrent ? (
                        <Spinner
                          animation="border"
                          size="sm"
                          variant="primary"
                        />
                      ) : null
                    ) : null}
                  </span>
                  <span className="flex-grow-1">
                    {instrument.toUpperCase()}
                  </span>
                  <span className="text-muted me-2">
                    ({displayCount}/{instrumentStats.totalScores})
                  </span>
                  {!isGenerating && canEditCovers && currentUser && (
                    <Button
                      size="sm"
                      variant={hasCover ? "success" : "outline-secondary"}
                      aria-label={`Capa de ${instrument}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setCoverInstrument(instrument);
                      }}
                    >
                      {hasCover ? "✓ Trocar capa" : "Capa"}
                    </Button>
                  )}
                  {!isGenerating && !canEditCovers && hasCover && (
                    <span className="text-success small">✓ Capa</span>
                  )}
                </ListGroup.Item>
                {!isGenerating && isIncluded && hasFallback && (
                  <ListGroup.Item
                    className="d-flex align-items-center ps-5"
                    style={{ backgroundColor: "#f8f9fa", borderTop: "none" }}
                  >
                    <Form.Check
                      type="checkbox"
                      id={`fallback-${instrument}`}
                      label={`Usar ${fallback} como fallback (+${countWithFallback - count})`}
                      checked={fallbackEnabled}
                      onChange={() =>
                        setEnabledFallbacks((prev) => {
                          const next = new Set(prev);
                          next.has(instrument)
                            ? next.delete(instrument)
                            : next.add(instrument);
                          return next;
                        })
                      }
                    />
                  </ListGroup.Item>
                )}
              </div>
            );
          },
        )}
      </ListGroup>
      {instrumentStats.stats.length === 0 && (
        <p className="text-muted text-center">
          Nenhum instrumento disponível nas músicas deste caderninho.
        </p>
      )}
      {isGenerating && (
        <div className="progress mt-3">
          <div
            className="progress-bar"
            role="progressbar"
            style={{ width: `${generationProgress}%` }}
            aria-valuenow={generationProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {Math.round(generationProgress)}%
          </div>
        </div>
      )}
      {!isGenerating && (
        <div className="mt-3">
          <div className="d-flex align-items-center">
            <Form.Check
              type="switch"
              id="carnival-mode"
              label="Capa e índice do carnaval"
              checked={carnivalMode}
              onChange={(e) => setCarnivalMode(e.target.checked)}
            />
            <HelpIcon tooltip={CarnivalModeTooltip} />
          </div>
          <div className="d-flex align-items-center">
            <Form.Check
              type="switch"
              id="back-number"
              label="Página de número no verso"
              checked={backSheetPageNumber}
              onChange={(e) => setBackSheetPageNumber(e.target.checked)}
            />
            <HelpIcon tooltip={BackPageTooltip} />
          </div>
          <div className="d-flex align-items-center">
            <Form.Check
              type="switch"
              id="anti-assedio"
              label="Cartilha anti-assédio"
              checked={antiAssedioPages}
              onChange={(e) => setAntiAssedioPages(e.target.checked)}
            />
            <HelpIcon tooltip={AntiAssedioTooltip} />
          </div>
          {import.meta.env.DEV && (
            <Form.Check
              type="switch"
              id="debug-boxes"
              label="Debug"
              checked={debugBoundingBoxes}
              onChange={(e) => setDebugBoundingBoxes(e.target.checked)}
            />
          )}
        </div>
      )}
      <div className="d-flex gap-2 mt-3">
        <Button
          variant="primary"
          disabled={isGenerating || included.size === 0}
          onClick={() => void handleGenerate()}
        >
          {isGenerating
            ? "Gerando..."
            : `Gerar ${included.size} caderninho${included.size !== 1 ? "s" : ""}`}
        </Button>
      </div>
      {coverInstrument && coverOptions && canEditCovers && currentUser && (
        <SongbookCoverModal
          key={`${songbook.currentRevisionId}:${coverInstrument}`}
          instrument={coverInstrument}
          songbook={songbook}
          revision={{ ...revision, covers }}
          user={currentUser}
          options={coverOptions}
          createPreview={createCoverPreview}
          saveCovers={saveSongbookCovers}
          onHide={() => setCoverInstrument(null)}
          onSaved={(newCovers) => {
            setSavedCovers(newCovers);
            setCoverInstrument(null);
            onCoversSaved();
          }}
        />
      )}
    </section>
  );
}
