import { Modal } from "../../../atoms/Modal";
import { Input } from "../../../atoms/Input";
import { Button } from "../../../atoms/Button";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Alert, Form, Spinner } from "react-bootstrap";
import type { User } from "firebase/auth";
import type { Instrument } from "../../../../../types/instrument";
import type { SongbookDoc, SongbookRevisionDoc } from "../../../../../types/docs";
import type { WithId } from "../../../../lib/db";
import type { CoverPreviewOptions } from "../../../../lib/pdfPreview";

export function SongbookCoverModal({
  instrument, songbook, revision, user, options, createPreview, saveCovers,
  onSaved, onHide,
}: {
  instrument: Instrument;
  songbook: WithId<SongbookDoc>;
  revision: SongbookRevisionDoc;
  user: User;
  options: CoverPreviewOptions;
  createPreview: (options: CoverPreviewOptions) => Promise<string>;
  saveCovers: typeof import("../../../../lib/songbookCovers").saveSongbookCovers;
  onSaved: (covers: SongbookRevisionDoc["covers"]) => void;
  onHide: () => void;
}) {
  const heading = useId();
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [previewAttempt, retryPreview] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const hasSaved = !!options.coverImageUrl;
  const dirty = !!file || (removed && hasSaved);

  useEffect(() => {
    if (!file) {
      setFileUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewOptions = useMemo(() => ({
    ...options,
    coverImageUrl: file ? fileUrl : removed ? "" : options.coverImageUrl,
  }), [options, file, fileUrl, removed]);

  useEffect(() => {
    let active = true;
    let url = "";
    setPreviewUrl("");
    setPreviewError("");
    if (!file || fileUrl) {
      void createPreview(previewOptions).then((result) => {
        url = result;
        if (active) {
          setPreviewUrl(result);
        } else {
          URL.revokeObjectURL(result);
        }
      }).catch(() => {
        if (active) {
          setPreviewError("Não foi possível carregar a prévia. Verifique a imagem ou tente novamente.");
        }
      });
    }
    return () => {
      active = false;
      if (url) { URL.revokeObjectURL(url); }
    };
  }, [createPreview, previewOptions, previewAttempt, file, fileUrl]);

  const save = async () => {
    if (saveLock.current || !dirty || !previewUrl || previewError || validationError) { return; }
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const covers = await saveCovers({
        songbook,
        current: revision,
        added: file ? new Map([[instrument, file]]) : new Map<Instrument, File>(),
        removed: removed ? [instrument] : [],
        user,
      });
      onSaved(covers);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar a capa.");
      saveLock.current = false;
      setSaving(false);
    }
  };

  const dismiss = () => { if (!saveLock.current) { onHide(); } };

  return (
    <Modal show onHide={dismiss} backdrop={saving ? "static" : true} keyboard={!saving} size="lg" centered aria-labelledby={heading}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title id={heading}>Capa · {instrument.charAt(0).toUpperCase() + instrument.slice(1)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-2">{songbook.title} · Prévia da capa</p>
        <div className="bg-light rounded p-2 mb-2" style={{ aspectRatio: "18 / 13" }}>
          {previewUrl ? (
            <img title="Prévia da capa no PDF" alt="Prévia da capa do caderninho" src={previewUrl} className="w-100 h-100 bg-white" style={{ objectFit: "contain" }} />
          ) : previewError ? null : (
            <div className="d-flex h-100 align-items-center justify-content-center" role="status">
              <Spinner animation="border" aria-label="Carregando prévia" />
            </div>
          )}
        </div>
        <p className="text-muted small text-center">18 × 13 cm · paisagem</p>
        <p className="text-muted small">
          {removed ? "A capa será removida ao salvar." : file ? "Alteração ainda não salva." : hasSaved ? "Capa salva para este instrumento." : "Nenhuma imagem salva. A prévia mostra a página padrão."}
        </p>
        <Form.Group controlId="songbook-cover-image">
          <Form.Label>Selecionar imagem</Form.Label>
          <Form.Control as={Input} type="file" accept="image/png,image/jpeg" disabled={saving}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const selected = event.target.files?.[0];
              event.target.value = "";
              if (!selected) { return; }
              if (!["image/png", "image/jpeg"].includes(selected.type)) {
                setValidationError("Selecione uma imagem PNG ou JPEG. A capa anterior foi mantida.");
                return;
              }
              setValidationError("");
              setSaveError("");
              setRemoved(false);
              setFile(selected);
            }} />
          <Form.Text>PNG ou JPEG. A imagem é ajustada à página sem recorte.</Form.Text>
        </Form.Group>
        {file && <p className="small text-break mt-2 mb-0">{file.name}</p>}
        {(file || (hasSaved && !removed)) && (
          <Button variant="danger-secondary" size="sm" className="mt-3" disabled={saving} onClick={() => {
            setFile(null);
            setRemoved(true);
            setValidationError("");
            setSaveError("");
          }}>Remover capa</Button>
        )}
        {validationError && <Alert variant="danger" className="mt-3 mb-0">{validationError}</Alert>}
        {previewError && <Alert variant="danger" className="mt-3 mb-0">
          {previewError}{" "}
          <Button variant="danger-secondary" size="sm" onClick={() => retryPreview((n) => n + 1)}>Tentar novamente</Button>
        </Alert>}
        {saveError && <Alert variant="danger" className="mt-3 mb-0">{saveError}</Alert>}
        {saving && <p className="small mt-3 mb-0" role="status">Enviando imagem e salvando nova versão…</p>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={dismiss} disabled={saving}>Cancelar</Button>
        <Button onClick={() => void save()} disabled={saving || !dirty || !previewUrl || !!previewError || !!validationError}>
          {saving ? <><Spinner animation="border" size="sm" /> Salvando…</> : "Salvar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
