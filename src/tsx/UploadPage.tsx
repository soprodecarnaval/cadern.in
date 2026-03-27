import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Form,
  ProgressBar,
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
  getOrCreateDefaultProject,
  getUserProjects,
  uploadScore,
  type OnProgress,
  type UploadProgress,
} from "../lib/uploadScore";
import { translateWarning } from "../lib/warningMessages";
import type { Warning } from "../result";
import { ScoreDisplay, type ScoreDisplayPart } from "./ScoreDisplay";

function useFileUrls(fileMap: Map<string, File> | null): Map<string, string> {
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!fileMap) { setUrlMap(new Map()); return; }
    const urls = new Map<string, string>();
    for (const [key, file] of fileMap) urls.set(key, URL.createObjectURL(file));
    setUrlMap(urls);
    return () => { for (const url of urls.values()) URL.revokeObjectURL(url); };
  }, [fileMap]);
  return urlMap;
}

const FIELD_HELP = [
  { field: "workTitle", description: "nome da música" },
  { field: "composer", description: "nome do(s) compositor(es)" },
  {
    field: "lyricist",
    description: "tags separadas por vírgula; a primeira tag é o estilo da música",
  },
  { field: "source", description: "verso referência (sub)" },
];

type Step = "idle" | "uploading" | "done";

export function UploadPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { songId: existingSongId } = useParams<{ songId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("idle");
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<Warning[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      getUserProjects(currentUser.uid),
      getOrCreateDefaultProject(currentUser),
    ]).then(([userProjects, defaultProjectId]) => {
      setProjects(userProjects);
      if (!selectedProjectId) {
        setSelectedProjectId(defaultProjectId);
      }
    });
  }, [currentUser]);

  if (!currentUser) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">Faça login para enviar partituras.</Alert>
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
  };

  const handlePublish = async () => {
    if (!parsed || !currentUser) return;
    setError("");
    setStep("uploading");
    try {
      const onProgress: OnProgress = (p) => setProgress(p);
      await uploadScore(parsed, selectedProjectId, currentUser, onProgress, existingSongId);
      setStep("done");
    } catch (err: any) {
      setError(err.message ?? "Erro ao enviar partitura");
      setStep("idle");
    }
  };

  const fileUrls = useFileUrls(parsed?.fileMap ?? null);

  const allWarnings = [...(parsed?.warnings ?? []), ...validationWarnings];
  const hasErrors = validationWarnings.length > 0;
  const globalWarnings = allWarnings.filter((w) => !w.meta?.file && !w.meta?.partName);

  const warningsForFile = (file: File) =>
    allWarnings.filter((w) => w.meta?.file === file.name);

  const warningsForPart = (partName: string) =>
    allWarnings.filter((w) => w.meta?.partName === partName);

  if (step === "uploading") {
    return (
      <Container className="mt-4">
        <h2>{existingSongId ? "Nova revisão" : "Enviar partitura"}</h2>
        <Card>
          <Card.Body>
            <p>
              {progress?.stage === "uploading" && "Enviando arquivos..."}
              {progress?.stage === "writing-firestore" && "Salvando metadados..."}
            </p>
            <ProgressBar
              now={
                progress && progress.filesTotal > 0
                  ? (progress.filesUploaded / progress.filesTotal) * 100
                  : 0
              }
              label={progress ? `${progress.filesUploaded}/${progress.filesTotal}` : ""}
            />
          </Card.Body>
        </Card>
      </Container>
    );
  }

  if (step === "done") {
    return (
      <Container className="mt-4">
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
        <Alert variant="warning">
          Fazer upload novamente substituirá a versão recém-publicada.
          <div className="mt-2">
            <Button
              variant="outline-warning"
              onClick={() => {
                setParsed(null);
                setValidationWarnings([]);
                setStep("idle");
              }}
            >
              Fazer upload novamente
            </Button>
          </div>
        </Alert>
        {parsed && (
          <ScoreDisplay
            title={parsed.title}
            composer={parsed.composer}
            sub={parsed.sub}
            tags={parsed.tags}
            arrangementMidiUrl={fileUrls.get("midi") ?? null}
            parts={parsed.parts.map((part): ScoreDisplayPart => ({
              name: part.name,
              instrument: part.instrument,
              svgUrls: part.svg.map((key) => fileUrls.get(key) ?? ""),
              midiUrl: fileUrls.get(`parts/${part.name}.midi`) ?? null,
            }))}
          />
        )}
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <h2>{existingSongId ? "Nova revisão" : "Enviar partitura"}</h2>

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

      <Card className="mb-3">
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
            onChange={(e) => handleFiles((e.target as HTMLInputElement).files)}
          />
        </Card.Body>
      </Card>

      {parsed && (
        <>
          {globalWarnings.length > 0 && (
            <Alert variant={hasErrors ? "danger" : "warning"}>
              <ul className="mb-0">
                {globalWarnings.map((w, i) => (
                  <li key={i}>{translateWarning(w.code, w.meta)}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Arquivos processados</Card.Title>
              <ul className="mb-0" style={{ listStyle: "none", padding: 0 }}>
                {Array.from(parsed.fileMap.entries()).map(([key, file]) => {
                  const fw = warningsForFile(file);
                  return (
                    <li key={key} className="d-flex align-items-center gap-2 py-1">
                      <code>{key}</code>
                      {fw.map((w, i) => (
                        <Badge bg="warning" text="dark" key={i}>{translateWarning(w.code, w.meta)}</Badge>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </Card.Body>
          </Card>

          <ScoreDisplay
            title={parsed.title}
            composer={parsed.composer}
            sub={parsed.sub}
            tags={parsed.tags}
            arrangementMidiUrl={fileUrls.get("midi") ?? null}
            parts={parsed.parts.map((part): ScoreDisplayPart => ({
              name: part.name,
              instrument: part.instrument,
              svgUrls: part.svg.map((key) => fileUrls.get(key) ?? ""),
              midiUrl: fileUrls.get(`parts/${part.name}.midi`) ?? null,
              warnings: warningsForPart(part.name).map((w) => translateWarning(w.code, w.meta)),
            }))}
          />

          <Card className="mb-3">
            <Card.Body>
              <Form.Group>
                <Form.Label><strong>Projeto</strong></Form.Label>
                <Form.Select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Card.Body>
          </Card>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="d-flex gap-2 mb-4">
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
    </Container>
  );
}
