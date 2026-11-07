import { useState } from "react";
import { Alert, Button, Form, Spinner, Table } from "react-bootstrap";
import { useAuth } from "../auth";
import type { WithId } from "../lib/db";
import {
  COVER_TYPES,
  matchCoverFiles,
  saveSongbookCovers,
} from "../lib/songbookCovers";
import type { SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import type { Instrument } from "../../types/instrument";

/**
 * Per-instrument covers of a saved songbook (admins). Files are matched to
 * instruments by name; saving creates a new revision.
 */
export function SongbookCoversEditor({
  songbook,
  revision,
  onDone,
}: {
  songbook: WithId<SongbookDoc>;
  revision: SongbookRevisionDoc;
  onDone: (saved: boolean) => void;
}) {
  const { currentUser } = useAuth();
  const [added, setAdded] = useState<Map<Instrument, File>>(new Map());
  const [removed, setRemoved] = useState<Set<Instrument>>(new Set());
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = (files: FileList | null) => {
    const result = matchCoverFiles([...(files ?? [])]);
    setAdded((prev) => new Map([...prev, ...result.matched]));
    setRemoved((prev) => {
      const next = new Set(prev);
      result.matched.forEach((_, i) => next.delete(i));
      return next;
    });
    setUnmatched(result.unmatched);
  };

  const toggleRemove = (instrument: Instrument) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(instrument)) {
        next.delete(instrument);
      } else {
        next.add(instrument);
      }
      return next;
    });

  const handleSave = async () => {
    if (!currentUser) {
      return;
    }
    setPending(true);
    setError("");
    try {
      await saveSongbookCovers({
        songbook,
        current: revision,
        added,
        removed: [...removed],
        user: currentUser,
      });
      onDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setPending(false);
    }
  };

  const instruments = [
    ...new Set([
      ...(Object.keys(revision.covers) as Instrument[]),
      ...added.keys(),
    ]),
  ].sort();

  return (
    <section className="mb-4">
      <h5>Capas</h5>
      <Form.Group className="mb-2">
        <Form.Control
          type="file"
          multiple
          accept={COVER_TYPES.join(",")}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleFiles(e.target.files)
          }
        />
        <Form.Text className="text-muted">
          PNG ou JPEG, com o instrumento no nome do arquivo (ex.:
          capa-trompete.png).
        </Form.Text>
      </Form.Group>
      {unmatched.length > 0 && (
        <Alert variant="warning" className="py-2">
          Instrumento não reconhecido: {unmatched.join(", ")}
        </Alert>
      )}
      {instruments.length > 0 && (
        <Table size="sm">
          <tbody>
            {instruments.map((instrument) => {
              const newFile = added.get(instrument);
              const isRemoved = removed.has(instrument);
              return (
                <tr key={instrument} className={isRemoved ? "text-muted" : ""}>
                  <td>{instrument}</td>
                  <td>
                    {isRemoved ? (
                      <s>removida</s>
                    ) : newFile ? (
                      <>nova: {newFile.name}</>
                    ) : (
                      <a href={revision.covers[instrument]?.url} target="_blank" rel="noreferrer">
                        atual
                      </a>
                    )}
                  </td>
                  <td className="text-end">
                    {revision.covers[instrument] && !newFile && (
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0"
                        onClick={() => toggleRemove(instrument)}
                      >
                        {isRemoved ? "manter" : "remover"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <div className="d-flex gap-2">
        <Button
          disabled={pending || (added.size === 0 && removed.size === 0)}
          onClick={() => void handleSave()}
        >
          {pending ? <Spinner animation="border" size="sm" /> : "Salvar capas"}
        </Button>
        <Button variant="secondary" onClick={() => onDone(false)}>
          Cancelar
        </Button>
      </div>
      {error && <div className="text-danger mt-2">{error}</div>}
    </section>
  );
}
