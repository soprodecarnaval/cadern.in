import { Button } from "../../../atoms/Button";
import { Checkbox } from "../../../atoms/Choice";
import { Modal } from "../../../atoms/Modal";
import { useEffect, useId, useMemo, useState } from "react";
import { Form, OverlayTrigger, Spinner, Tooltip } from "react-bootstrap";
import type { User } from "firebase/auth";
import type {
  SongbookDoc,
  SongbookPrintSettings,
  SongbookRevisionDoc,
} from "../../../../../types/docs";
import type { Instrument } from "../../../../../types/instrument";
import type {
  NumberedSongbookItemViewModel,
  NumberedSongbookScoreViewModel,
} from "../../../../../types/viewModels";
import type { WithId } from "../../../../lib/db";
import { computeInstrumentStats, instrumentFallbacks } from "../../../../lib/pdfGeneration";
import { isSongbookSection } from "../../../../lib/songbook";
import { printSettingsOf, samePrintSettings } from "../../../../lib/songbookPrint";
import { SongbookCoverModal } from "./SongbookCoverModal";
import "../../scores/card/ScoreRow.css";
import "./SongbookPrintSettingsDialog.css";

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
    <span style={{ cursor: "help", marginLeft: "0.5rem", color: "var(--ds-text-secondary)" }}>
      ?
    </span>
  </OverlayTrigger>
);

export type SongbookPrintSettingsServices = {
  saveSongbookPrintSettings: typeof import("../../../../lib/db").saveSongbookPrintSettings;
  saveSongbookCovers: typeof import("../../../../lib/songbookCovers").saveSongbookCovers;
  createCoverPreview: typeof import("../../../../lib/pdfPreview").createSongbookCoverPreview;
};

/**
 * "Configurações de impressão" (037): covers, fallback instruments, the
 * back-page number and anti-assédio pages, saved with the songbook's version.
 * Nothing prints from here; Imprimir and the readers use what's saved (038).
 * Covers save on their own, as soon as their dialog does.
 *
 * The draft starts from what's saved when the dialog mounts, and survives a
 * reload while open (a cover saved): remount it (a new `key`) per opening.
 */
export function SongbookPrintSettingsDialogView({
  show,
  currentUser,
  services,
  songbook,
  revision,
  items,
  onSaved,
  onHide,
}: {
  show: boolean;
  currentUser: User | null;
  services: SongbookPrintSettingsServices;
  songbook: WithId<SongbookDoc>;
  revision: SongbookRevisionDoc;
  items: NumberedSongbookItemViewModel[];
  // After a save (settings or a cover): the page reloads the songbook.
  onSaved: () => void;
  onHide: () => void;
}) {
  const heading = useId();
  const saved = printSettingsOf(revision);
  const [draft, setDraft] = useState<SongbookPrintSettings>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coverInstrument, setCoverInstrument] = useState<Instrument | null>(null);
  const [savedCovers, setSavedCovers] = useState<SongbookRevisionDoc["covers"] | null>(null);
  const covers = savedCovers ?? revision.covers;

  useEffect(() => {
    setSavedCovers(null);
  }, [revision]);

  const scores = useMemo(
    () => items.filter(
      (i): i is NumberedSongbookScoreViewModel => !isSongbookSection(i) && !i.deleted,
    ),
    [items],
  );
  const { stats, totalScores } = useMemo(() => computeInstrumentStats(scores), [scores]);

  const coverOptions = useMemo(() => coverInstrument ? ({
    title: songbook.title,
    instrument: coverInstrument,
    coverImageUrl: covers[coverInstrument]?.url ?? "",
    // The carnival cover and index aren't offered here.
    carnivalMode: false,
  }) : null, [coverInstrument, songbook.title, covers]);

  const dirty = !samePrintSettings(draft, saved);
  const toggleFallback = (instrument: Instrument) =>
    setDraft((d) => ({
      ...d,
      fallbacks: d.fallbacks.includes(instrument)
        ? d.fallbacks.filter((f) => f !== instrument)
        : [...d.fallbacks, instrument],
    }));

  const save = async () => {
    if (!currentUser || !dirty || saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await services.saveSongbookPrintSettings(songbook, draft, currentUser.uid);
      onSaved();
      onHide();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Hidden, not closed, while a cover's dialog is open: the draft stays. */}
      <Modal
        show={show && !coverInstrument}
        onHide={() => { if (!saving) { onHide(); } }}
        backdrop={saving ? "static" : true}
        keyboard={!saving}
        aria-labelledby={heading}
        size="lg"
        centered
      >
        <Modal.Header closeButton={!saving} closeLabel="Fechar">
          <Modal.Title id={heading}>Configurações de impressão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Valem para esta versão do caderninho, onde ele for impresso. As capas
            são salvas assim que você as confirma.
          </p>
          <div className="score-card-list">
            {stats.map(({ instrument, count, countWithFallback }) => {
              const hasCover = !!covers[instrument]?.url;
              const fallback = instrumentFallbacks[instrument];
              const extra = fallback && countWithFallback ? countWithFallback - count : 0;
              const fallbackOn = draft.fallbacks.includes(instrument);
              return (
                <div key={instrument} className="score-card">
                  <div className="score-card-row print-settings-row">
                    <span className="score-card-main score-card-title">
                      {instrument.toUpperCase()}
                    </span>
                    <span className="text-muted">
                      ({fallbackOn && countWithFallback ? countWithFallback : count}/{totalScores})
                    </span>
                    {currentUser && (
                      <Button
                        size="sm"
                        variant={hasCover ? "primary" : "secondary"}
                        className="text-nowrap"
                        aria-label={`Capa de ${instrument}`}
                        onClick={() => setCoverInstrument(instrument)}
                        disabled={saving}
                      >
                        {hasCover ? "✓ Trocar capa" : "Capa"}
                      </Button>
                    )}
                  </div>
                  {fallback && extra > 0 && (
                    <div className="score-card-details print-settings-fallback">
                      <Checkbox
                        id={`fallback-${instrument}`}
                        label={`Usar ${fallback} nas músicas sem ${instrument} (+${extra})`}
                        checked={fallbackOn}
                        disabled={saving}
                        onChange={() => toggleFallback(instrument)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {stats.length === 0 && (
            <p className="text-muted text-center">
              Nenhum instrumento disponível nas músicas deste caderninho.
            </p>
          )}
          <div className="mt-3">
            <div className="d-flex align-items-center">
              <Form.Check
                type="switch"
                id="back-number"
                label="Página de número no verso"
                checked={draft.backSheetPageNumber}
                disabled={saving}
                onChange={(e) => setDraft((d) => ({ ...d, backSheetPageNumber: e.target.checked }))}
              />
              <HelpIcon tooltip={BackPageTooltip} />
            </div>
            <div className="d-flex align-items-center">
              <Form.Check
                type="switch"
                id="anti-assedio"
                label="Cartilha anti-assédio"
                checked={draft.antiAssedioPages}
                disabled={saving}
                onChange={(e) => setDraft((d) => ({ ...d, antiAssedioPages: e.target.checked }))}
              />
              <HelpIcon tooltip={AntiAssedioTooltip} />
            </div>
          </div>
          {error && <div className="text-danger mt-3" role="alert">{error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={saving} onClick={onHide}>
            Cancelar
          </Button>
          <Button disabled={!dirty || saving || !currentUser} onClick={() => void save()}>
            {saving ? <><Spinner animation="border" size="sm" aria-hidden /> Salvando…</> : "Salvar"}
          </Button>
        </Modal.Footer>
      </Modal>
      {coverInstrument && coverOptions && currentUser && (
        <SongbookCoverModal
          key={`${songbook.currentRevisionId}:${coverInstrument}`}
          instrument={coverInstrument}
          songbook={songbook}
          revision={{ ...revision, covers }}
          user={currentUser}
          options={coverOptions}
          createPreview={services.createCoverPreview}
          saveCovers={services.saveSongbookCovers}
          onHide={() => setCoverInstrument(null)}
          onSaved={(newCovers) => {
            setSavedCovers(newCovers);
            setCoverInstrument(null);
            onSaved();
          }}
        />
      )}
    </>
  );
}
