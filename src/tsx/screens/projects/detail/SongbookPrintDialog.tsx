import { useEffect, useId, useState } from "react";
import { Alert } from "react-bootstrap";
import type { SongbookDoc, SongbookRevisionDoc } from "../../../../../types/docs";
import { zInstrument, type Instrument } from "../../../../../types/instrument";
import type { WithId } from "../../../../lib/db";
import { buildSongbookSections, type Section } from "../../../../lib/pdfGeneration";
import { instrumentLabel } from "../../../../lib/preferredInstrument";
import { fromSongbookRevision } from "../../../../lib/songbook";
import { Button } from "../../../atoms/Button";
import { Checkbox } from "../../../atoms/Choice";
import { Modal } from "../../../atoms/Modal";
import type { ArrangementPdfEntry } from "../../../../createSongBook";

export type SongbookPrintServices = Pick<typeof import("../../../../lib/db"), "getSongbookRevision"> & {
  loadPinnedScores: typeof import("../../../../lib/songbookScores").loadPinnedScores;
};

type PrintBook = {
  sections: Section[];
  covers: SongbookRevisionDoc["covers"];
  instruments: Instrument[];
  arrangements: ArrangementPdfEntry[];
  withoutArrangement: number;
};

export function SongbookPrintDialog({ songbook, services, onHide }: {
  songbook: WithId<SongbookDoc>;
  services: SongbookPrintServices;
  onHide: () => void;
}) {
  const heading = useId();
  const [book, setBook] = useState<PrintBook | null>(null);
  const [selectedParts, setSelectedParts] = useState<Instrument[]>([]);
  const [includeArrangements, setIncludeArrangements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const revision = await services.getSongbookRevision(songbook.id, songbook.currentRevisionId);
        if (!revision) {throw new Error("Caderninho não encontrado.");}
        const sections = buildSongbookSections(fromSongbookRevision(revision, await services.loadPinnedScores(revision)));
        const scores = sections.flatMap((section) => section.scores).filter((item) => !item.deleted);
        const instruments = zInstrument.options.filter((instrument) =>
          scores.some(({ revision }) => revision.parts.some((part) => part.instrument === instrument)),
        );
        const arrangements = scores.flatMap(({ score, revision }) => revision.arrangementSvg?.length
          ? [{ title: score.title, urls: revision.arrangementSvg }]
          : []);
        const withoutArrangement = scores.length - arrangements.length;
        if (active) {
          setBook({ sections, covers: revision.covers, instruments, arrangements, withoutArrangement });
        }
      } catch {
        if (active) {setError("Não foi possível carregar este caderninho.");}
      }
    })();
    return () => {active = false;};
  }, [songbook.id, songbook.currentRevisionId, services, attempt]);

  const hasSelection = selectedParts.length > 0 || includeArrangements;
  const allPartsSelected = !!book?.instruments.length && selectedParts.length === book.instruments.length;

  const print = async () => {
    if (!book || !hasSelection || printing) {return;}
    setPrinting(true);
    setError(null);
    try {
      const instruments = book.instruments.filter((instrument) => selectedParts.includes(instrument));
      if (instruments.length) {
        const { generateSongbookPdfs } = await import("../../../../lib/generateSongbookPdfs");
        await generateSongbookPdfs({
          title: songbook.title,
          sections: book.sections,
          instruments,
          covers: Object.fromEntries(instruments.map((instrument) => [instrument, book.covers[instrument]?.url ?? ""])),
          fallbackInstruments: new Set(),
          carnivalMode: false,
          backSheetPageNumber: false,
          antiAssedioPages: false,
        });
      }
      if (includeArrangements) {
        const { createArrangementSongbookPdf } = await import("../../../../createSongBook");
        await createArrangementSongbookPdf(book.arrangements, songbook.title);
      }
    } catch {
      setError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal show onHide={onHide} aria-labelledby={heading} centered>
      <Modal.Header closeButton closeLabel="Fechar">
        <Modal.Title id={heading}>Imprimir {songbook.title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}{" "}
          {!book && <Button size="sm" variant="text" onClick={() => {setError(null); setAttempt((n) => n + 1);}}>Tentar novamente</Button>}
        </Alert>}
        {!book && !error && <p role="status">Carregando opções de impressão…</p>}
        {book && <>
          <fieldset disabled={printing}>
            <legend className="fs-6 fw-bold">Partes</legend>
            {book.instruments.length > 0 ? <>
              <Checkbox className="is-block mb-2" id={`${heading}-all`} label="Todas as partes" checked={allPartsSelected}
                indeterminate={selectedParts.length > 0 && !allPartsSelected} onChange={(event) => {
                setSelectedParts(event.target.checked ? book.instruments : []);
                setError(null);
              }} />
              <div className="ms-4 mb-3 d-flex flex-column gap-2">
                {book.instruments.map((instrument) => (
                  <Checkbox key={instrument} id={`${heading}-${instrument.replace(/ /g, "-")}`}
                    label={instrumentLabel(instrument)} checked={selectedParts.includes(instrument)} onChange={(event) => {
                      setSelectedParts(event.target.checked
                        ? [...selectedParts, instrument]
                        : selectedParts.filter((part) => part !== instrument));
                      setError(null);
                    }} />
                ))}
              </div>
            </> : <p className="text-muted">Nenhuma parte disponível.</p>}
          </fieldset>
          <Checkbox className="is-block" id={`${heading}-arrangements`} label="Arranjos (A4 horizontal)"
            checked={includeArrangements} disabled={printing || !book.arrangements.length} onChange={(event) => {
              setIncludeArrangements(event.target.checked);
              setError(null);
            }} />
          {!book.arrangements.length && <p className="text-muted mt-2 mb-0">Nenhum arranjo disponível nesta versão do caderninho.</p>}
          {includeArrangements && book.withoutArrangement > 0 && (
            <p className="text-muted mt-2 mb-0">{book.withoutArrangement} {book.withoutArrangement === 1
              ? "partitura sem arranjo ficará fora do PDF."
              : "partituras sem arranjo ficarão fora do PDF."}</p>
          )}
        </>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Fechar</Button>
        <Button disabled={!book || !hasSelection || printing} onClick={() => void print()}>
          {printing ? "Gerando PDF…" : "Baixar PDFs"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
