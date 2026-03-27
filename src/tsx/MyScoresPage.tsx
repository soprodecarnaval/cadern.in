import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Container,
  Spinner,
  Table,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth";
import { zSongDoc, zRevisionDoc } from "../../firestore-types";
import { softDeleteSong } from "../lib/uploadScore";

interface MyRevision {
  id: string;
  revisionNumber: number;
  uploadedAt: any;
}

interface MySong {
  id: string;
  title: string;
  composer: string;
  createdAt: any;
  latestRevisionId: string;
}

function formatDate(timestamp: any): string {
  if (!timestamp?.toDate) return "—";
  return timestamp.toDate().toLocaleDateString("pt-BR");
}

function SongRow({
  song,
  deleting,
  onDelete,
}: {
  song: MySong;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [revisions, setRevisions] = useState<MyRevision[] | null>(null);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const handleToggle = async () => {
    if (!expanded && revisions === null) {
      setLoadingRevisions(true);
      const snap = await getDocs(collection(db, "songs", song.id, "revisions"));
      const loaded: MyRevision[] = snap.docs.map((d) => {
        const data = zRevisionDoc.parse(d.data());
        return { id: d.id, revisionNumber: data.revisionNumber, uploadedAt: data.uploadedAt };
      });
      loaded.sort((a, b) => b.revisionNumber - a.revisionNumber);
      setRevisions(loaded);
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
  const [songs, setSongs] = useState<MySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "songs"),
      where("uploadedBy", "==", currentUser.uid),
    );
    getDocs(q).then((snap) => {
      const results: MySong[] = [];
      for (const d of snap.docs) {
        const data = zSongDoc.parse(d.data());
        if (data.deletedAt) continue;
        results.push({
          id: d.id,
          title: data.title,
          composer: data.composer,
          createdAt: data.createdAt,
          latestRevisionId: data.latestRevisionId,
        });
      }
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

  const handleDelete = async (songId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta partitura?")) return;
    setDeleting(songId);
    try {
      await softDeleteSong(songId);
      setSongs((prev) => prev.filter((s) => s.id !== songId));
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
