import {
  Button,
  Col,
  Form,
  Row,
  OverlayTrigger,
  Tooltip,
  ListGroup,
  Modal,
  Spinner,
} from "react-bootstrap";
import React, { useState, useMemo } from "react";
import type { Instrument } from "../../types/instrument";
import type {
  SongbookViewModel,
  SongbookItemViewModel,
  SongbookScoreViewModel,
} from "../../types/viewModels";
import { isSongbookSection } from "../lib/songbook";
import {
  buildSongbookSections,
  computeInstrumentStats,
  instrumentFallbacks,
  type Section,
} from "../lib/pdfGeneration";
import { generateSongbookPdfs } from "../lib/generateSongbookPdfs";

interface PdfGeneratorProps {
  songBook: SongbookViewModel;
  // A saved songbook's per-instrument covers (download URLs). When given, they
  // replace the per-generation cover pickers.
  covers?: Partial<Record<Instrument, string>>;
}

export type { Section };

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
      �
    </span>
  </OverlayTrigger>
);

const PDFGenerator = ({ songBook, covers }: PdfGeneratorProps) => {
  // Deleted scores keep their number but get no pages, so they don't count.
  const scores = songBook.items.filter(
    (r: SongbookItemViewModel) => !isSongbookSection(r) && !r.deleted,
  ) as SongbookScoreViewModel[];

  const [songbookTitle, setTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentInstrument, setCurrentInstrument] = useState<Instrument | null>(
    null,
  );
  const [completedInstruments, setCompletedInstruments] = useState<
    Set<Instrument>
  >(new Set());
  const [showModal, setShowModal] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState<
    Set<Instrument>
  >(new Set());
  const [instrumentCovers, setInstrumentCovers] = useState<
    Map<Instrument, string>
  >(new Map());
  const [enabledFallbacks, setEnabledFallbacks] = useState<Set<Instrument>>(
    new Set(),
  );

  const onInputSongbookTitle = ({
    target: { value },
  }: React.ChangeEvent<HTMLInputElement>) => setTitle(value);

  const [carnivalMode, setCarnivalMode] = useState(false);
  const [backSheetPageNumber, setBackSheetPageNumber] = useState(false);
  const [antiAssedioPages, setAntiAssedioPages] = useState(false);
  const [debugBoundingBoxes, setDebugBoundingBoxes] = useState(false);

  const setInstrumentCover = (instrument: Instrument, file: File | null) => {
    setInstrumentCovers((prev) => {
      const next = new Map(prev);
      if (file) {
        next.set(instrument, URL.createObjectURL(file));
      } else {
        next.delete(instrument);
      }
      return next;
    });
  };

  // Calculate which instruments have parts and how many scores have each
  const instrumentStats = useMemo(() => computeInstrumentStats(scores), [scores]);

  const toggleInstrument = (instrument: Instrument) => {
    setSelectedInstruments((prev) => {
      const next = new Set(prev);
      if (next.has(instrument)) {
        next.delete(instrument);
      } else {
        next.add(instrument);
      }
      return next;
    });
  };

  const selectAllInstruments = () => {
    setSelectedInstruments(
      new Set(instrumentStats.stats.map((s) => s.instrument)),
    );
  };

  const deselectAllInstruments = () => {
    setSelectedInstruments(new Set());
  };

  const openModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (scores.length < 1) {
      alert("Selecione ao menos uma música!");
      return;
    }
    if (songbookTitle === "") {
      alert("Digite um título para o caderninho!");
      return;
    }
    // Pre-select all available instruments
    selectAllInstruments();
    setCompletedInstruments(new Set());
    setCurrentInstrument(null);
    setInstrumentCovers(new Map());
    setEnabledFallbacks(new Set());
    setShowModal(true);
  };

  const closeModal = () => {
    if (!isGenerating) {
      setShowModal(false);
      setCompletedInstruments(new Set());
      setGenerationProgress(0);
    }
  };

  const onGeneratePdfs = async () => {
    if (selectedInstruments.size === 0) {
      alert("Selecione ao menos um instrumento!");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setCompletedInstruments(new Set());
    setCurrentInstrument(null);

    try {
      const sections = buildSongbookSections(songBook.items);
      const instrumentsToGenerate = Array.from(selectedInstruments);

      await generateSongbookPdfs({
        sections,
        instruments: instrumentsToGenerate,
        title: songbookTitle,
        covers: covers ?? Object.fromEntries(instrumentCovers),
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

      console.log("Terminei");
    } catch (error) {
      console.error("Error generating PDFs:", error);
      alert("Ocorreu um erro ao gerar os PDFs. Por favor, tente novamente.");
    } finally {
      setIsGenerating(false);
      setCurrentInstrument(null);
    }
  };

  return (
    <>
      <Row className="mt-4">
        <Form className="d-flex gap-1" onSubmit={openModal}>
          <Col>
            <Form.Control
              type="text"
              onChange={onInputSongbookTitle}
              value={songbookTitle}
              placeholder="Título do caderninho"
            />
          </Col>
          <Col xs="auto">
            <Button type="submit" className="text-nowrap">
              Gerar caderninhos
            </Button>
          </Col>
        </Form>
      </Row>

      {/* Instrument Selection / Progress Modal */}
      <Modal
        show={showModal}
        onHide={closeModal}
        centered
        backdrop={isGenerating ? "static" : true}
        keyboard={!isGenerating}
      >
        <Modal.Header closeButton={!isGenerating}>
          <Modal.Title>
            {isGenerating ? "Gerando caderninhos" : "Gerar caderninhos"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!isGenerating && (
            <div className="d-flex justify-content-between mb-3">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={selectAllInstruments}
              >
                Selecionar todos
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={deselectAllInstruments}
              >
                Limpar seleção
              </Button>
            </div>
          )}
          <ListGroup>
            {instrumentStats.stats.map(
              ({ instrument, count, countWithFallback }) => {
                const isSelected = selectedInstruments.has(instrument);
                const isCompleted = completedInstruments.has(instrument);
                const isCurrent = currentInstrument === instrument;
                const isGreyedOut = isGenerating && !isSelected;

                const hasCover = covers
                  ? !!covers[instrument]
                  : instrumentCovers.has(instrument);
                const fallback = instrumentFallbacks[instrument];
                const hasFallback =
                  fallback && countWithFallback && countWithFallback > count;
                const fallbackEnabled = enabledFallbacks.has(instrument);
                const displayCount =
                  fallbackEnabled && countWithFallback
                    ? countWithFallback
                    : count;

                return (
                  <React.Fragment key={instrument}>
                    <ListGroup.Item
                      action={!isGenerating}
                      onClick={() =>
                        !isGenerating && toggleInstrument(instrument)
                      }
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
                            checked={isSelected}
                            onChange={() => toggleInstrument(instrument)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : isSelected ? (
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
                      {!isGenerating && covers && hasCover && (
                        <span className="text-success small">✓ Capa</span>
                      )}
                      {!isGenerating && !covers && (
                        <>
                          <Form.Label
                            htmlFor={`cover-${instrument}`}
                            className={`btn btn-sm ${hasCover ? "btn-success" : "btn-outline-secondary"} mb-0`}
                            style={{ cursor: "pointer", fontSize: "0.75rem" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hasCover ? "✓ Capa" : "Capa"}
                          </Form.Label>
                          <Form.Control
                            id={`cover-${instrument}`}
                            type="file"
                            hidden
                            accept="image/png,image/jpeg"
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const file = e.target.files?.[0] ?? null;
                              setInstrumentCover(instrument, file);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </>
                      )}
                    </ListGroup.Item>
                    {!isGenerating && isSelected && hasFallback && (
                      <ListGroup.Item
                        className="d-flex align-items-center ps-5"
                        style={{
                          backgroundColor: "#f8f9fa",
                          borderTop: "none",
                        }}
                      >
                        <Form.Check
                          type="checkbox"
                          id={`fallback-${instrument}`}
                          label={`Usar ${fallback} como fallback (+${countWithFallback - count})`}
                          checked={fallbackEnabled}
                          onChange={() => {
                            setEnabledFallbacks((prev) => {
                              const next = new Set(prev);
                              if (next.has(instrument)) {
                                next.delete(instrument);
                              } else {
                                next.add(instrument);
                              }
                              return next;
                            });
                          }}
                        />
                      </ListGroup.Item>
                    )}
                  </React.Fragment>
                );
              },
            )}
          </ListGroup>
          {instrumentStats.stats.length === 0 && (
            <p className="text-muted text-center">
              Nenhum instrumento disponível nas músicas selecionadas.
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
        </Modal.Body>
        <Modal.Footer>
          {!isGenerating && completedInstruments.size === 0 && (
            <>
              <Button variant="secondary" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void onGeneratePdfs();
                }}
                disabled={selectedInstruments.size === 0}
              >
                Gerar {selectedInstruments.size} caderninho
                {selectedInstruments.size !== 1 ? "s" : ""}
              </Button>
            </>
          )}
          {isGenerating && (
            <Button variant="secondary" disabled>
              Gerando...
            </Button>
          )}
          {!isGenerating && completedInstruments.size > 0 && (
            <Button variant="success" onClick={closeModal}>
              Fechar
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export { PDFGenerator };
