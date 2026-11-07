import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  getOrCreateDefaultProject,
  uploadScore,
  type UploadProgress,
} from "../../lib/uploadScore";
import {
  getMemberRole,
  getUserMemberProjects,
  type WithId,
} from "../../lib/db";
import type { ProjectDoc } from "../../../types/docs";
import { isEditor } from "../../lib/roles";
import { resolveUploadTarget, type UploadTarget } from "../../lib/uploadTarget";
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
  /** The user's own file, which gets the uploaded identity written back. */
  msczPath: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "uploading"; progress: UploadProgress }
  | { kind: "done"; scoreId: string; localStamped: boolean }
  | { kind: "error"; message: string };

export function UploadPanel({ user, directory, msczPath }: Props) {
  const [projects, setProjects] = useState<WithId<ProjectDoc>[]>([]);
  const [projectId, setProjectId] = useState("");
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Every user gets an Acervo, so the list is never empty and there is always
  // a sensible default; uploads still need editor rights on the target.
  useEffect(() => {
    void (async () => {
      const defaultId = await getOrCreateDefaultProject(user);
      const memberOf = await getUserMemberProjects(user.uid);
      const roles = await Promise.all(
        memberOf.map((p) => getMemberRole(p.id, user.uid)),
      );
      const mine = memberOf.filter((_, i) => isEditor(roles[i]));
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

  // What the upload will do is stated before anything is written.
  const title = parsed?.title;
  const source = parsed?.source;
  useEffect(() => {
    let current = true;
    setTarget(null);
    if (title && projectId) {
      void resolveUploadTarget({ title, source }, projectId).then((t) => {
        if (current) {
          setTarget(t);
        }
      });
    }
    return () => {
      current = false;
    };
  }, [title, source, projectId]);

  const upload = useCallback(async () => {
    if (!parsed || !projectId || !target) {
      return;
    }
    try {
      const identity = await uploadScore(parsed, projectId, target, user, {
        onProgress: (progress) => setStatus({ kind: "uploading", progress }),
        stampMscz: async (file, ids) =>
          new File(
            [
              await window.api.stampMsczBytes(
                new Uint8Array(await file.arrayBuffer()),
                ids,
              ),
            ],
            file.name,
            { type: file.type },
          ),
      });
      // The upload already succeeded: a file MuseScore has locked only costs
      // the next upload's identity, so it's reported, not fatal.
      const localStamped = await window.api
        .stampMsczFile(msczPath, identity)
        .then(() => true)
        .catch(() => false);
      setStatus({ kind: "done", scoreId: identity.scoreId, localStamped });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [parsed, projectId, target, user, msczPath]);

  if (status.kind === "done") {
    return (
      <section className="upload-panel">
        <strong>Enviado para o cadern.in</strong>
        <span>{status.scoreId}</span>
        {!status.localStamped && (
          <p className="upload-notice">
            Não foi possível atualizar o arquivo original. Feche-o no MuseScore;
            sem isso, o próximo envio pode não reconhecer esta partitura.
          </p>
        )}
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

      {target?.kind === "version" && (
        <p className="upload-notice">
          Versão nova de «{target.title}» neste projeto.
        </p>
      )}
      {target?.kind === "fork" && (
        <p className="upload-notice">
          «{target.sourceTitle}» é do projeto {target.sourceProjectTitle}. O envio
          cria uma derivação neste projeto.
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

      <button
        type="button"
        disabled={!parsed || !target || busy}
        onClick={() => void upload()}
      >
        {status.kind === "uploading" ? "Enviando…" : "Enviar"}
      </button>
    </section>
  );
}
