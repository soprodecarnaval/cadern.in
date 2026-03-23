import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Container,
  Form,
  ProgressBar,
  Row,
  Table,
} from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  parseUploadedFiles,
  validateParsedScore,
  type ParsedScore,
} from "../lib/parseUploadedFiles";
import {
  getOrCreateAcervoProject,
  getUserProjects,
  uploadScore,
  type OnProgress,
  type UploadProgress,
} from "../lib/uploadScore";
import type { Warning } from "../result";

const FIELD_HELP = [
  { field: "workTitle", description: "nome da música" },
  { field: "composer", description: "nome do(s) compositor(es)" },
  {
    field: "lyricist",
    description: "tags separadas por vírgula; a primeira tag é o estilo da música",
  },
  { field: "source", description: "verso referência (sub)" },
];

type Step = "select" | "review" | "uploading" | "done";

export function UploadPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { songId: existingSongId } = useParams<{ songId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<Warning[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>(
    [],
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      getUserProjects(currentUser.uid),
      getOrCreateAcervoProject(currentUser),
    ]).then(([userProjects, acervoId]) => {
      setProjects(userProjects);
      if (!selectedProjectId) {
        setSelectedProjectId(acervoId);
      }
    });
  }, [currentUser]);

  if (!currentUser) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">
          Faça login para enviar partituras.
        </Alert>
      </Container>
    );
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");

    const fileArray = Array.from(files);
    const result = await parseUploadedFiles(fileArray);
    const validation = validateParsedScore(result);

    setParsed(result);
    setValidationWarnings(validation);
    setStep("review");
  };

  const handlePublish = async () => {
    if (!parsed || !currentUser) return;
    setError("");
    setStep("uploading");

    try {
      const onProgress: OnProgress = (p) => setProgress(p);
      await uploadScore(
        parsed,
        selectedProjectId,
        currentUser,
        onProgress,
        existingSongId,
      );
      setStep("done");
    } catch (err: any) {
      setError(err.message ?? "Erro ao enviar partitura");
      setStep("review");
    }
  };

  const allWarnings = [
    ...(parsed?.warnings ?? []),
    ...validationWarnings,
  ];
  const hasErrors = validationWarnings.length > 0;

  return (
    <Container className="mt-4">
      <h2>{existingSongId ? "Nova revisão" : "Enviar partitura"}</h2>

      {step === "select" && (
        <>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Mapeamento de campos do MuseScore</Card.Title>
              <Table size="sm" bordered>
                <thead>
                  <tr>
                    <th>Campo no MuseScore</th>
                    <th>Uso no cadern.in</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_HELP.map((f) => (
                    <tr key={f.field}>
                      <td><code>{f.field}</code></td>
                      <td>{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <p>
                Selecione a pasta exportada pelo plugin do MuseScore contendo os
                arquivos <code>.mscz</code>, <code>.svg</code>,{" "}
                <code>.midi</code> e <code>.metajson</code>.
              </p>
              <Form.Control
                ref={fileInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is not in the type defs
                webkitdirectory=""
                directory=""
                multiple
                onChange={(e) =>
                  handleFiles((e.target as HTMLInputElement).files)
                }
              />
            </Card.Body>
          </Card>
        </>
      )}

      {step === "review" && parsed && (
        <>
          {allWarnings.length > 0 && (
            <Alert variant={hasErrors ? "danger" : "warning"}>
              <strong>
                {hasErrors ? "Erros encontrados:" : "Avisos:"}
              </strong>
              <ul className="mb-0 mt-1">
                {allWarnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Card className="mb-3">
            <Card.Body>
              <Row>
                <Col sm={6}>
                  <p><strong>Título:</strong> {parsed.title || <em>não detectado</em>}</p>
                  <p><strong>Compositor:</strong> {parsed.composer || <em>não detectado</em>}</p>
                  <p><strong>Sub:</strong> {parsed.sub || <em>não detectado</em>}</p>
                  <p><strong>Tags:</strong> {parsed.tags.length > 0 ? parsed.tags.join(", ") : <em>nenhuma</em>}</p>
                </Col>
                <Col sm={6}>
                  <p><strong>Arquivos:</strong> {parsed.fileMap.size}</p>
                  <p><strong>Partes:</strong> {parsed.parts.length}</p>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {parsed.parts.length > 0 && (
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Partes detectadas</Card.Title>
                <Table size="sm" bordered>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Instrumento</th>
                      <th>Páginas SVG</th>
                      <th>MIDI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.parts.map((part) => (
                      <tr key={part.name}>
                        <td>{part.name}</td>
                        <td>{part.instrument}</td>
                        <td>{part.svg.length}</td>
                        <td>{parsed.fileMap.has(`parts/${part.name}.midi`) ? "sim" : "não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}

          <Card className="mb-3">
            <Card.Body>
              <Form.Group>
                <Form.Label><strong>Projeto</strong></Form.Label>
                <Form.Select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Card.Body>
          </Card>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="d-flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setStep("select");
                setParsed(null);
                setValidationWarnings([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              disabled={hasErrors || parsed.parts.length === 0}
              onClick={() => void handlePublish()}
            >
              {existingSongId ? "Enviar revisão" : "Publicar"}
            </Button>
          </div>
        </>
      )}

      {step === "uploading" && progress && (
        <Card>
          <Card.Body>
            <p>
              {progress.stage === "uploading" && "Enviando arquivos..."}
              {progress.stage === "writing-firestore" && "Salvando metadados..."}
            </p>
            <ProgressBar
              now={
                progress.filesTotal > 0
                  ? (progress.filesUploaded / progress.filesTotal) * 100
                  : 0
              }
              label={`${progress.filesUploaded}/${progress.filesTotal}`}
            />
          </Card.Body>
        </Card>
      )}

      {step === "done" && (
        <Alert variant="success">
          <p>Partitura publicada com sucesso!</p>
          <div className="d-flex gap-2">
            <Button variant="primary" onClick={() => navigate("/")}>
              Ir para o acervo
            </Button>
            <Button variant="outline-primary" onClick={() => navigate("/my-scores")}>
              Minhas partituras
            </Button>
          </div>
        </Alert>
      )}
    </Container>
  );
}
