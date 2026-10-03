import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  getOrCreateDefaultProject,
  uploadScore,
  type UploadProgress,
} from "../../lib/uploadScore";
import {
  getScore,
  getScoreRevisions,
  getUserMemberProjects,
  type WithId,
} from "../../lib/db";
import type { ProjectDoc } from "../../../types/docs";
import { isEditor } from "../../lib/roles";
import { slugify } from "../../lib/slugify";
import {
  parseUploadedFiles,
  validateParsedScore,
  type ParsedScore,
} from "../../lib/parseUploadedFiles";
import { translateWarning } from "../../lib/warningMessages";
import type { Warning } from "../../result";

interface Props {
  user: User;
  /** Folder produced by the export step. */
  directory: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "uploading"; progress: UploadProgress }
  | { kind: "done"; scoreId: string; revision: number }
  | { kind: "error"; message: string };

export function UploadPanel({ user, directory }: Props) {
  const [projects, setProjects] = useState<WithId<ProjectDoc>[]>([]);
  const [projectId, setProjectId] = useState("");
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [existingRevisions, setExistingRevisions] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Every user gets an Acervo, so the list is never empty and there is always
  // a sensible default; uploads still need editor rights on the target.
  useEffect(() => {
    void (async () => {
      const defaultId = await getOrCreateDefaultProject(user);
      const mine = (await getUserMemberProjects(user.uid)).filter((p) =>
        isEditor(p, user.uid),
      );
      setProjects(mine);
      setProjectId(defaultId);
    })();
  }, [user]);

  // Read and parse once; the folder does not change under us.
  useEffect(() => {
    void (async () => {
      setStatus({ kind: "reading" });
      try {
        const raw = await window.api.readExportFolder(directory);
        const files = raw.map((f) => new File([f.bytes], f.name));
        const result = await parseUploadedFiles(files);
        setParsed(result);
        setWarnings([...result.warnings, ...validateParsedScore(result)]);
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  }, [directory]);

  // uploadScore derives the id the same way; overwriting silently would
  // destroy the existing revision, so surface it before anything is written.
  const scoreId = parsed && projectId ? `${projectId}-${slugify(parsed.title)}` : "";
  useEffect(() => {
    void (async () => {
      if (!scoreId) {
        setExistingRevisions(null);
        return;
      }
      const existing = await getScore(scoreId);
      setExistingRevisions(
        existing && !existing.deletedAt
          ? (await getScoreRevisions(scoreId)).length
          : null,
      );
    })();
  }, [scoreId]);

  const upload = useCallback(async () => {
    if (!parsed || !projectId) {
      return;
    }
    try {
      const id = await uploadScore(
        parsed,
        projectId,
        user,
        (progress) => setStatus({ kind: "uploading", progress }),
        existingRevisions !== null ? scoreId : undefined,
      );
      setStatus({
        kind: "done",
        scoreId: id,
        revision: (existingRevisions ?? 0) + 1,
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [parsed, projectId, user, existingRevisions, scoreId]);

  if (status.kind === "done") {
    return (
      <section className="upload-panel">
        <strong>Enviado para o cadern.in</strong>
        <span>
          {status.scoreId} — revisão {status.revision}
        </span>
      </section>
    );
  }

  const busy = status.kind === "reading" || status.kind === "uploading";

  return (
    <section className="upload-panel">
      <h2>Enviar para o cadern.in</h2>

      <label>
        <span>Projeto</span>
        <select
          value={projectId}
          disabled={busy}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      {parsed && (
        <p className="upload-summary">
          {parsed.title} — {parsed.parts.length} parte(s)
        </p>
      )}

      {existingRevisions !== null && (
        <p className="upload-notice">
          Esta partitura já existe neste projeto com {existingRevisions}{" "}
          revisão(ões). O envio criará a revisão {existingRevisions + 1}.
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="upload-warnings">
          {warnings.map((w, i) => (
            <li key={i}>{translateWarning(w.code, w.meta)}</li>
          ))}
        </ul>
      )}

      {status.kind === "uploading" && (
        <p className="upload-progress">
          Enviando {status.progress.filesUploaded}/{status.progress.filesTotal}…
        </p>
      )}

      {status.kind === "error" && <p className="error">{status.message}</p>}

      <button type="button" disabled={!parsed || busy} onClick={() => void upload()}>
        {status.kind === "uploading" ? "Enviando…" : "Enviar"}
      </button>
    </section>
  );
}
