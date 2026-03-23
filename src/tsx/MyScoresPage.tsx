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
import { zSongDoc } from "../../firestore-types";
import { softDeleteSong } from "../lib/uploadScore";

interface MySong {
  id: string;
  title: string;
  composer: string;
  projectId: string;
  createdAt: any;
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
          projectId: data.projectId,
          createdAt: data.createdAt,
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
        <Alert variant="info">
          Você ainda não enviou nenhuma partitura.
        </Alert>
      ) : (
        <Table bordered hover>
          <thead>
            <tr>
              <th>Título</th>
              <th>Compositor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <tr key={song.id}>
                <td>{song.title}</td>
                <td>{song.composer}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Link to={`/upload/${encodeURIComponent(song.id)}`}>
                      <Button size="sm" variant="outline-primary">
                        Nova revisão
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={deleting === song.id}
                      onClick={() => void handleDelete(song.id)}
                    >
                      {deleting === song.id ? "Excluindo..." : "Excluir"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
