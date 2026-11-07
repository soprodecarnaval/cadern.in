import { useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { updateScoreMetadataOverride } from "../lib/db";
import type { ScoreMetadata } from "../../types/docs";

type Field = keyof ScoreMetadata;

const LABELS: Record<Field, string> = {
  title: "Título",
  composer: "Compositor",
  sub: "Trecho",
  tags: "Tags",
};

const FIELDS: Field[] = ["title", "composer", "sub", "tags"];

const toInput = (meta: ScoreMetadata, field: Field): string =>
  field === "tags" ? meta.tags.join(", ") : meta[field];

const tagsFrom = (input: string): string[] =>
  input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Admin corrections over the uploaded metadata (collab-flow §2.2). Only fields
 * that differ from the upload are stored, so a later upload's values still
 * show through everywhere else.
 */
export function ScoreMetadataEditor({
  show,
  scoreId,
  uploaded,
  current,
  onHide,
  onSaved,
}: {
  show: boolean;
  scoreId: string;
  uploaded: ScoreMetadata;
  current: ScoreMetadata;
  onHide: () => void;
  onSaved: (override: Partial<ScoreMetadata>) => void;
}) {
  const [values, setValues] = useState<Record<Field, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f, toInput(current, f)])) as Record<
      Field,
      string
    >,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const override: Partial<ScoreMetadata> = {};
    for (const field of FIELDS) {
      if (values[field].trim() === toInput(uploaded, field)) {
        continue;
      }
      if (field === "tags") {
        override.tags = tagsFrom(values.tags);
      } else {
        override[field] = values[field].trim();
      }
    }
    setPending(true);
    setError("");
    try {
      await updateScoreMetadataOverride(scoreId, override);
      onSaved(override);
      onHide();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Editar metadados</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {FIELDS.map((field) => {
          const fromUpload = toInput(uploaded, field);
          const edited = values[field].trim() !== fromUpload;
          return (
            <Form.Group key={field} className="mb-3">
              <Form.Label>{LABELS[field]}</Form.Label>
              <Form.Control
                value={values[field]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field]: e.target.value }))
                }
              />
              <Form.Text className="text-muted">
                Do arquivo: {fromUpload || "—"}
                {edited && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 ms-2 align-baseline"
                    onClick={() =>
                      setValues((v) => ({ ...v, [field]: fromUpload }))
                    }
                  >
                    restaurar
                  </Button>
                )}
              </Form.Text>
            </Form.Group>
          );
        })}
        {error && <div className="text-danger">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button onClick={() => void handleSave()} disabled={pending}>
          {pending ? <Spinner animation="border" size="sm" /> : "Salvar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
