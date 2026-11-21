// One upload flow for the exporter and the web send screen (ticket 011):
// revalidate the context (auth, membership, expected revisions) against live
// data, decide the target, and, right before writing, revalidate again; then
// upload and re-pin the songbook the upload was launched from. Nothing is
// written when a check fails. Firestore and Storage rules stay the authority.
import type { User } from "firebase/auth";
import type { ScoreIdentity } from "../../types/metajson";
import type { UploadContext } from "../../types/exportDeepLink";
import {
  validateExportContext,
  type ExportContextServices,
  type ResolvedExportContext,
} from "./exportContext";
import type { ParsedScore } from "./parseUploadedFiles";
import { pinnedToRevision } from "./songbook";
import type { UploadProgress } from "./uploadScore";
import { resolveUploadTarget, type UploadTarget, type UploadTargetLookups } from "./uploadTarget";
import { projectPath } from "./routes";

export type { UploadContext } from "../../types/exportDeepLink";

const CONTEXT_KEYS = ["scoreId", "expectedScoreRevisionId", "songbookId", "expectedSongbookRevisionId"] as const;

/** The web route's context: the project from the path, the rest from the query (untrusted, like a deep link). */
export function uploadContextFromSearchParams(projectId: string, params: URLSearchParams): UploadContext {
  const context: UploadContext = { projectId };
  for (const key of CONTEXT_KEYS) {
    const value = params.get(key);
    if (value) {context[key] = value;}
  }
  return context;
}

/** `/:slug/enviar?…` for a context. */
export function uploadPath(context: UploadContext): string {
  const params = new URLSearchParams();
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (value) {params.set(key, value);}
  }
  const query = params.toString();
  return `${projectPath(context.projectId)}/enviar${query ? `?${query}` : ""}`;
}

export type UploadFlowServices = ExportContextServices &
  Pick<typeof import("./db"), "getSongbookRevision" | "createSongbookRevision">;

export type UploadChecks = {
  resolved: ResolvedExportContext;
  /**
   * Set when the context names a score but the file goes elsewhere (another
   * score, or a new one): the screen asks before sending.
   */
  targetMismatch?: string;
};

export type PreparedUpload =
  | { ok: true; target: UploadTarget; checks: UploadChecks }
  | { ok: false; reason: string };

/** Revalidates the context and decides the target. Writes nothing. */
export async function prepareUpload(
  context: UploadContext,
  parsed: Pick<ParsedScore, "title" | "source">,
  uid: string,
  services: UploadFlowServices,
  lookups?: UploadTargetLookups,
): Promise<PreparedUpload> {
  const check = await validateExportContext(context, uid, services);
  if (!check.ok) {return check;}
  if (context.songbookId) {
    // The send screen belongs to one project; a songbook of another project
    // would make the re-pin fail after the upload, breaking all-or-nothing.
    const songbook = await services.getSongbookById(context.songbookId);
    if (!songbook || songbook.projectId !== context.projectId) {
      return { ok: false, reason: "Caderninho não encontrado." };
    }
  }
  const target = await resolveUploadTarget(parsed, context.projectId, lookups);
  const checks: UploadChecks = { resolved: check.resolved };
  if (context.scoreId) {
    const sameScore =
      target.scoreId === context.scoreId ||
      (target.kind === "fork" && target.source.scoreId === context.scoreId) ||
      (target.kind === "version" &&
        (await (lookups?.getScore ?? services.getScore)(target.scoreId))?.forkedFrom?.scoreId === context.scoreId);
    if (!sameScore) {
      const destination =
        target.kind === "new" ? "uma partitura nova" : `“${target.kind === "version" ? target.title : target.sourceTitle}”`;
      checks.targetMismatch =
        `Este arquivo não é uma versão de “${check.resolved.scoreTitle ?? context.scoreId}”: ` +
        `ele será enviado como ${destination}.`;
    }
  }
  return { ok: true, target, checks };
}

export type RepinOutcome = "updated" | "skipped-stale" | "none";

/**
 * Re-pins the launching songbook's entry to the new revision, under the
 * role and concurrency rules createSongbookRevision enforces; never touches
 * another songbook pinning the same score. Checked for staleness right before
 * this write: the gap since the pre-upload check is the whole upload.
 */
export async function repinSongbook(
  context: UploadContext,
  identity: ScoreIdentity,
  title: string,
  uid: string,
  services: Pick<UploadFlowServices, "getSongbookById" | "getSongbookRevision" | "createSongbookRevision">,
): Promise<RepinOutcome> {
  if (!context.songbookId) {return "none";}
  const songbook = await services.getSongbookById(context.songbookId);
  if (!songbook || songbook.deletedAt || songbook.currentRevisionId !== context.expectedSongbookRevisionId) {
    return "skipped-stale";
  }
  const current = await services.getSongbookRevision(songbook.id, songbook.currentRevisionId);
  if (!current) {return "skipped-stale";}
  const { content, note } = pinnedToRevision(current, identity.scoreId, identity.revisionId, title);
  await services.createSongbookRevision(songbook.id, content, { createdBy: uid, note });
  return "updated";
}

export type CommitOptions = {
  services: UploadFlowServices;
  upload: (
    parsed: ParsedScore,
    projectId: string,
    target: UploadTarget,
    user: User,
    options: { onProgress?: (progress: UploadProgress) => void; stampMscz?: (file: File, identity: ScoreIdentity) => Promise<File> },
  ) => Promise<ScoreIdentity>;
  stampMscz?: (file: File, identity: ScoreIdentity) => Promise<File>;
  onProgress?: (progress: UploadProgress) => void;
  lookups?: UploadTargetLookups;
};

export type CommitResult =
  | { ok: true; identity: ScoreIdentity; target: UploadTarget; repin: RepinOutcome }
  | { ok: false; reason: string };

/**
 * Revalidates right before writing (the context may have gone stale while
 * the pages were being formatted), re-resolves the target, uploads, and
 * re-pins. A changed target aborts: the user confirmed another one.
 */
export async function commitUpload(
  context: UploadContext,
  parsed: ParsedScore,
  expectedTarget: UploadTarget,
  user: User,
  options: CommitOptions,
): Promise<CommitResult> {
  const prepared = await prepareUpload(context, parsed, user.uid, options.services, options.lookups);
  if (!prepared.ok) {return prepared;}
  if (prepared.target.kind !== expectedTarget.kind || prepared.target.scoreId !== expectedTarget.scoreId) {
    return {
      ok: false,
      reason: "O destino deste envio mudou enquanto a partitura era formatada. Confira e envie de novo.",
    };
  }
  const identity = await options.upload(parsed, context.projectId, prepared.target, user, {
    onProgress: options.onProgress,
    stampMscz: options.stampMscz,
  });
  const repin = await repinSongbook(context, identity, parsed.title, user.uid, options.services);
  return { ok: true, identity, target: prepared.target, repin };
}
