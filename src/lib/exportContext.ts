import type { ExportDeepLinkContext } from "../../types/exportDeepLink";
import type { WithId } from "./db";
import { isEditor } from "./roles";
import { resolveScoreMetadata } from "./scoreMetadata";
import type { ScoreDoc } from "../../types/docs";

export interface ResolvedExportContext {
  projectId: string;
  projectTitle: string;
  scoreId?: string;
  scoreTitle?: string;
  songbookId?: string;
  songbookTitle?: string;
}

export type ExportContextCheck =
  | { ok: true; resolved: ResolvedExportContext }
  | { ok: false; reason: string };

export type ExportContextServices = Pick<
  typeof import("./db"),
  "getMemberRole" | "getProject" | "getScore" | "getSongbookById"
>;

/**
 * Revalidates a deep link's identifiers against live data (010): auth and
 * membership are re-checked regardless, and any expected revision carried
 * in the link must still match — a stale link (score or songbook moved on
 * since the link was generated) aborts before any upload write, rather than
 * silently acting on state the launcher never saw.
 */
export async function validateExportContext(
  context: ExportDeepLinkContext,
  uid: string,
  services: ExportContextServices,
): Promise<ExportContextCheck> {
  const [role, project] = await Promise.all([
    services.getMemberRole(context.projectId, uid),
    services.getProject(context.projectId),
  ]);
  if (!project || project.deletedAt) {
    return { ok: false, reason: "Projeto não encontrado." };
  }
  if (!isEditor(role)) {
    return {
      ok: false,
      reason: "Você não tem permissão de edição neste projeto.",
    };
  }

  let scoreTitle: string | undefined;
  let score: WithId<ScoreDoc> | null = null;
  if (context.scoreId) {
    score = await services.getScore(context.scoreId);
    if (!score || score.deletedAt) {
      return { ok: false, reason: "Partitura não encontrada." };
    }
    if (
      context.expectedScoreRevisionId &&
      score.latestRevisionId !== context.expectedScoreRevisionId
    ) {
      return {
        ok: false,
        reason:
          "Esta partitura foi atualizada por outra pessoa desde que " +
          "este link foi gerado. Abra a página novamente para pegar um " +
          "link atualizado.",
      };
    }
    scoreTitle = resolveScoreMetadata(score).title;
  }

  let songbookTitle: string | undefined;
  if (context.songbookId) {
    const songbook = await services.getSongbookById(context.songbookId);
    if (!songbook || songbook.deletedAt) {
      return { ok: false, reason: "Caderninho não encontrado." };
    }
    if (
      context.expectedSongbookRevisionId &&
      songbook.currentRevisionId !== context.expectedSongbookRevisionId
    ) {
      return {
        ok: false,
        reason:
          "O caderninho mudou desde que este link foi gerado. Abra a " +
          "página novamente para pegar um link atualizado.",
      };
    }
    songbookTitle = songbook.title;
  }

  return {
    ok: true,
    resolved: {
      projectId: context.projectId,
      projectTitle: project.title,
      scoreId: context.scoreId,
      scoreTitle,
      songbookId: context.songbookId,
      songbookTitle,
    },
  };
}
