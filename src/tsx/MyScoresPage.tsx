import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Container,
  Spinner,
  Table,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { getUserScores, getScoreRevisions, softDeleteScore, type WithId } from "../lib/db";
import type { ScoreDoc, RevisionDoc } from "../../firestore-types";

function formatDate(timestamp: any): string {
  if (!timestamp?.toDate) return "—";
  return timestamp.toDate().toLocaleDateString("pt-BR");
}

function SongRow({
  song,
  deleting,
  onDelete,
}: {
  song: WithId<ScoreDoc>;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [revisions, setRevisions] = useState<WithId<RevisionDoc>[] | null>(null);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const handleToggle = async () => {
    if (!expanded && revisions === null) {
      setLoadingRevisions(true);
      setRevisions(await getScoreRevisions(song.id));
      setLoadingRevisions(false);
    }
    setExpanded((v) => !v);
  };

  return (
    <>
      <tr>
        <td>
          <button
            className="btn btn-link btn-sm p-0 me-2"
            onClick={() => void handleToggle()}
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            {expanded ? "▾" : "▸"}
          </button>
          {song.title}
        </td>
        <td>{song.composer}</td>
        <td>{formatDate(song.createdAt)}</td>
        <td>#{song.latestRevisionId}</td>
        <td>
          <div className="d-flex gap-2">
            <Link to={`/score/${encodeURIComponent(song.id)}`}>
              <Button size="sm" variant="outline-secondary">Ver</Button>
            </Link>
            <Link to={`/upload/${encodeURIComponent(song.id)}`}>
              <Button size="sm" variant="outline-primary">Nova revisão</Button>
            </Link>
            <Button
              size="sm"
              variant="outline-danger"
              disabled={deleting}
              onClick={onDelete}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0">
            {loadingRevisions ? (
              <div className="p-2"><Spinner animation="border" size="sm" /></div>
            ) : (
              <Table size="sm" className="mb-0" borderless>
                <tbody>
                  {revisions?.map((rev) => (
                    <tr key={rev.id} className="border-top">
                      <td className="ps-4 text-muted">Revisão #{rev.revisionNumber}</td>
                      <td className="text-muted">{formatDate(rev.uploadedAt)}</td>
                      <td>
                        <Link to={`/score/${encodeURIComponent(song.id)}/${rev.id}`}>
                          <Button size="sm" variant="outline-secondary">Ver</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function MyScoresPage() {
  const { currentUser } = useAuth();
  const [songs, setSongs] = useState<WithId<ScoreDoc>[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    getUserScores(currentUser.uid).then((results) => {
      setSongs(results);
      setLoading(false);
    });
  }, [currentUser]);

  if (!currentUser) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">Faça login para ver suas partituras.</Alert>
      </Container>
    );
  }

  const handleDelete = async (scoreId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta partitura?")) return;
    setDeleting(scoreId);
    try {
      await softDeleteScore(scoreId);
      setSongs((prev) => prev.filter((s) => s.id !== scoreId));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Minhas partituras</h2>
        <Link to="/upload">
          <Button variant="primary">Enviar partitura</Button>
        </Link>
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : songs.length === 0 ? (
        <Alert variant="info">Você ainda não enviou nenhuma partitura.</Alert>
      ) : (
        <Table bordered hover>
          <thead>
            <tr>
              <th>Título</th>
              <th>Compositor</th>
              <th>Criado em</th>
              <th>Revisão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                deleting={deleting === song.id}
                onDelete={() => void handleDelete(song.id)}

              />
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
