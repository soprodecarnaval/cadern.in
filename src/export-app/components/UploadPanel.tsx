import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { ExportResult } from "../../../scripts/lib/exportScore";
import { exportAndUpload, type ExportUploadProgress } from "../exportAndUpload";
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
import type { UploadTarget } from "../../lib/uploadTarget";
import {
  validateParsedScore,
  type ParsedScore,
} from "../../lib/parseUploadedFiles";
import { translateWarning } from "../../lib/warningMessages";
import type { Warning } from "../../result";

interface Props {
  user: User;
  exportScore: () => Promise<ExportResult>;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  /** The user's own file, which gets the uploaded identity written back. */
  msczPath: string;
}

type Status =
  | { kind: "idle" }
  | ExportUploadProgress
  | { kind: "done"; scoreId: string; localStamped: boolean; directory: string }
  | { kind: "error"; message: string };

// The project <select>'s own sentinel value for "create a new one instead".
const NEW_PROJECT = "__new__";

export function UploadPanel({ user, exportScore, msczPath, disabled, onBusyChange }: Props) {
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
    let current = true;
    void (async () => {
      try {
        const memberOf = await getUserMemberProjects(user.uid);
        const roles = await Promise.all(memberOf.map((p) => getMemberRole(p.id, user.uid)));
        if (!current) {return;}
        const mine = memberOf.filter((_, i) => isEditor(roles[i]));
        setProjects(mine);
        setProjectId(mine[0]?.id ?? "");
        setCreatingProject(mine.length === 0);
        setLoadedProjects(true);
      } catch (e) {
        if (current) {setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });}
      }
    })();
    return () => { current = false; };
  }, [user]);

  const handleProjectChange = (value: string) => {
    setStatus({ kind: "idle" });
    setParsed(null);
    setTarget(null);
    setWarnings([]);
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

  const busy = status.kind === "exporting" || status.kind === "reading" || status.kind === "uploading";

  const upload = async () => {
    if (!projectId || creatingProject || disabled || busy) {return;}
    onBusyChange(true);
    setParsed(null);
    setTarget(null);
    setWarnings([]);
    try {
      const result = await exportAndUpload({
        exportScore, projectId, user, msczPath,
        onProgress: setStatus,
        onParsed: (score, uploadTarget) => {
          setParsed(score);
          setTarget(uploadTarget);
          setWarnings([...score.warnings, ...validateParsedScore(score)]);
        },
      });
      setStatus({ kind: "done", ...result });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <section className="upload-panel">
      <h2>Destino</h2>

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
            disabled={busy || !loadedProjects}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            {!loadedProjects && <option value="">Carregando projetos…</option>}
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

      {busy && (
        <div className="export-progress" role="status" aria-live="polite">
          <span>
            {status.kind === "exporting" ? "Exportando partitura…"
              : status.kind === "reading" ? "Preparando envio…"
              : status.kind === "uploading" && status.progress
                ? `Enviando ${status.progress.filesUploaded}/${status.progress.filesTotal}…`
                : "Enviando…"}
          </span>
          <progress
            aria-label={status.kind === "exporting" ? "Exportando partitura" : "Enviando partitura"}
            max={status.kind === "uploading" ? status.progress?.filesTotal || 1 : 1}
            value={status.kind === "uploading" ? status.progress?.filesUploaded : undefined}
          />
        </div>
      )}

      {status.kind === "done" && (
        <div className="export-result" role="status">
          <strong>Enviado para o cadern.in</strong>
          <span>{status.scoreId}</span>
          <button type="button" onClick={() => void window.api.openFolder(status.directory)}>
            Abrir pasta
          </button>
          {!status.localStamped && (
            <p className="upload-notice">
              Não foi possível atualizar o arquivo original. Feche-o no MuseScore;
              sem isso, o próximo envio pode não reconhecer esta partitura.
            </p>
          )}
        </div>
      )}

      {status.kind === "error" && <p className="error">{status.message}</p>}

      <button
        type="button"
        className="btn-primary"
        disabled={disabled || !projectId || creatingProject || createPending || busy || !loadedProjects}
        onClick={() => void upload()}
      >
        Exportar para o cadern.in
      </button>
    </section>
  );
}
