import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { ExportResult } from "../../../scripts/lib/exportScore";
import { Button } from "../../tsx/atoms/Button";
import { exportAndUpload, type ExportUploadProgress } from "../exportAndUpload";
import {
  createSongbookRevision,
  getMemberRole,
  getProject,
  getScore,
  getSongbookById,
  getSongbookRevision,
} from "../../lib/db";
import {
  validateExportContext,
  type ResolvedExportContext,
} from "../../lib/exportContext";
import { repinSongbook } from "../../lib/uploadFlow";
import type { ExportDeepLinkContext } from "../../../types/exportDeepLink";
import type { UploadTarget } from "../../lib/uploadTarget";
import {
  validateParsedScore,
  type ParsedScore,
} from "../../lib/parseUploadedFiles";
import { translateWarning } from "../../lib/warningMessages";
import type { Warning } from "../../result";

const services = {
  getMemberRole,
  getProject,
  getScore,
  getSongbookById,
};

interface Props {
  user: User;
  context: ExportDeepLinkContext;
  exportScore: () => Promise<ExportResult>;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  /** The user's own file, which gets the uploaded identity written back. */
  msczPath: string;
}

type Status =
  | { kind: "idle" }
  | ExportUploadProgress
  | {
      kind: "done";
      scoreId: string;
      localStamped: boolean;
      directory: string;
      repin: "updated" | "skipped-stale" | "none";
    }
  | { kind: "error"; message: string };

type ContextState =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "valid"; resolved: ResolvedExportContext };

export function UploadPanel({
  user,
  context,
  exportScore,
  msczPath,
  disabled,
  onBusyChange,
}: Props) {
  const [contextState, setContextState] = useState<ContextState>({
    kind: "loading",
  });
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let current = true;
    setContextState({ kind: "loading" });
    void validateExportContext(context, user.uid, services).then((check) => {
      if (!current) {
        return;
      }
      setContextState(
        check.ok
          ? { kind: "valid", resolved: check.resolved }
          : { kind: "invalid", reason: check.reason },
      );
    });
    return () => {
      current = false;
    };
  }, [context, user]);

  const busy =
    status.kind === "exporting" ||
    status.kind === "reading" ||
    status.kind === "uploading";

  const upload = async () => {
    if (disabled || busy || contextState.kind !== "valid") {
      return;
    }
    // Re-checked right before the write, not just on arrival: a long export
    // (MuseScore CLI, then the upload itself) leaves plenty of time for the
    // link to go stale while the window was sitting open.
    const recheck = await validateExportContext(context, user.uid, services);
    if (!recheck.ok) {
      setContextState({ kind: "invalid", reason: recheck.reason });
      return;
    }
    const { projectId } = recheck.resolved;
    onBusyChange(true);
    setParsed(null);
    setTarget(null);
    setWarnings([]);
    try {
      const result = await exportAndUpload({
        exportScore,
        projectId,
        user,
        msczPath,
        onProgress: setStatus,
        onParsed: (score, uploadTarget) => {
          setParsed(score);
          setTarget(uploadTarget);
          setWarnings([...score.warnings, ...validateParsedScore(score)]);
        },
      });
      const repinned = await repin(result.scoreId, result.revisionId);
      setStatus({ kind: "done", ...result, repin: repinned });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      onBusyChange(false);
    }
  };

  // Re-pins the songbook the upload was launched from (src/lib/uploadFlow).
  const repin = (scoreId: string, revisionId: string) =>
    repinSongbook(context, { scoreId, revisionId }, parsed?.title ?? scoreId, user.uid, {
      getSongbookById,
      getSongbookRevision,
      createSongbookRevision,
    });

  if (contextState.kind === "loading") {
    return (
      <section className="upload-panel">
        <p className="muted">Verificando destino…</p>
      </section>
    );
  }

  if (contextState.kind === "invalid") {
    return (
      <section className="upload-panel">
        <div className="alert alert-danger" role="alert">
          {contextState.reason}
        </div>
      </section>
    );
  }

  const { resolved } = contextState;

  return (
    <section className="upload-panel">
      <h2>Destino</h2>
      <p className="upload-context">
        <strong>{resolved.projectTitle}</strong>
        {resolved.songbookTitle && <> · {resolved.songbookTitle}</>}
        {resolved.scoreTitle && <> · {resolved.scoreTitle}</>}
      </p>

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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void window.api.openFolder(status.directory)}
          >
            Abrir pasta
          </Button>
          {!status.localStamped && (
            <p className="upload-notice">
              Não foi possível atualizar o arquivo original. Feche-o no MuseScore;
              sem isso, o próximo envio pode não reconhecer esta partitura.
            </p>
          )}
          {status.repin === "updated" && (
            <p className="upload-notice">
              Caderninho «{resolved.songbookTitle}» atualizado para esta versão.
            </p>
          )}
          {status.repin === "skipped-stale" && (
            <p className="upload-notice">
              O caderninho mudou desde que este link foi gerado — a partitura
              foi enviada, mas o caderninho não foi atualizado. Abra-o para
              atualizar manualmente.
            </p>
          )}
        </div>
      )}

      {status.kind === "error" && (
        <div className="alert alert-danger" role="alert">{status.message}</div>
      )}

      <Button
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={() => void upload()}
      >
        Exportar para o cadern.in
      </Button>
    </section>
  );
}
