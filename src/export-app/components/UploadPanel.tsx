import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { uploadScore, type UploadProgress } from "../../lib/uploadScore";
import {
  createProject,
  getMemberRole,
  getProjectBySlug,
  getUserMemberProjects,
  type WithId,
} from "../../lib/db";
import type { ProjectDoc } from "../../../types/docs";
import { displayNameOf } from "../../lib/displayName";
import { isEditor } from "../../lib/roles";
import { slugify } from "../../lib/slugify";
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

// The project <select>'s own sentinel value for "create a new one instead".
const NEW_PROJECT = "__new__";

export function UploadPanel({ user, directory, msczPath }: Props) {
  const [projects, setProjects] = useState<WithId<ProjectDoc>[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loadedProjects, setLoadedProjects] = useState(false);
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // No project yet: every upload needs editor rights on a project, and there
  // is no auto-created one standing in — the user picks or creates one.
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    void (async () => {
      const memberOf = await getUserMemberProjects(user.uid);
      const roles = await Promise.all(
        memberOf.map((p) => getMemberRole(p.id, user.uid)),
      );
      const mine = memberOf.filter((_, i) => isEditor(roles[i]));
      setProjects(mine);
      setProjectId(mine[0]?.id ?? "");
      setCreatingProject(mine.length === 0);
      setLoadedProjects(true);
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

  const handleProjectChange = (value: string) => {
    if (value === NEW_PROJECT) {
      setCreatingProject(true);
      return;
    }
    setProjectId(value);
  };

  const handleCreateProject = useCallback(async () => {
    const title = newProjectTitle.trim();
    if (!title) {
      return;
    }
    setCreatePending(true);
    setCreateError("");
    try {
      const slug = slugify(title);
      const existing = await getProjectBySlug(slug);
      if (existing) {
        setCreateError(`O slug "${slug}" já está em uso. Escolha outro nome.`);
        return;
      }
      await createProject(
        slug,
        { title },
        { uid: user.uid, displayName: displayNameOf(user) },
      );
      setProjects((prev) => [
        ...prev,
        { id: slug, title, slug, memberIds: [user.uid] } as WithId<ProjectDoc>,
      ]);
      setProjectId(slug);
      setCreatingProject(false);
      setNewProjectTitle("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Erro ao criar projeto");
    } finally {
      setCreatePending(false);
    }
  }, [newProjectTitle, user]);

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
        {creatingProject ? (
          <div className="project-create">
            <input
              type="text"
              placeholder="Nome do novo projeto"
              value={newProjectTitle}
              disabled={createPending}
              onChange={(e) => setNewProjectTitle(e.target.value)}
            />
            <div className="project-create-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={createPending || !newProjectTitle.trim()}
                onClick={() => void handleCreateProject()}
              >
                {createPending ? "Criando…" : "Criar projeto"}
              </button>
              {projects.length > 0 && (
                <button
                  type="button"
                  className="btn-link"
                  disabled={createPending}
                  onClick={() => {
                    setCreatingProject(false);
                    setCreateError("");
                  }}
                >
                  Voltar à lista
                </button>
              )}
            </div>
            {createError && <p className="error">{createError}</p>}
          </div>
        ) : (
          <select
            value={projectId}
            disabled={busy}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
            <option value={NEW_PROJECT}>Criar novo projeto…</option>
          </select>
        )}
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
        disabled={!parsed || !target || busy || !loadedProjects}
        onClick={() => void upload()}
      >
        {status.kind === "uploading" ? "Enviando…" : "Enviar"}
      </button>
    </section>
  );
}
