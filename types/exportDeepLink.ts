/**
 * The exporter has no destination of its own (010): a launch always comes
 * from a `cadernin-export://` link built on the website, naming a project
 * and, optionally, the specific score/songbook context it was launched
 * from. Every identifier here is untrusted input carried across a process
 * boundary (and possibly held open for a while before the export finishes)
 * — the exporter revalidates auth, membership and the expected revisions
 * against live data before ever uploading anything.
 */
export const EXPORT_DEEP_LINK_PROTOCOL = "cadernin-export";

/**
 * Where an upload goes and what it was launched against: the exporter's deep
 * link and the web route `/:slug/enviar` carry the same context.
 */
export interface UploadContext {
  projectId: string;
  // Launched from a specific score (project page "nova versão", or the
  // songbook-scoped score page) — absent for a brand-new score.
  scoreId?: string;
  // The score's latest revision when the link was generated; staleness
  // (someone else uploaded a newer version meanwhile) aborts the upload.
  expectedScoreRevisionId?: string;
  // Launched from a songbook-scoped score page: a successful upload offers
  // to re-pin this songbook's entry to the new revision.
  songbookId?: string;
  // The songbook's current revision when the link was generated; staleness
  // (someone else edited the songbook meanwhile) aborts the upload — the
  // re-pin never happens against state the launcher never saw.
  expectedSongbookRevisionId?: string;
  // Web send screen only: reformat a stored revision instead of sending a
  // file (ticket 013). `baseRevisionId` is the revision whose .mscz and
  // formatting are loaded; the expected revisions still gate the write.
  mode?: "reformat";
  baseRevisionId?: string;
}

/** The exporter's name for the upload context. */
export type ExportDeepLinkContext = UploadContext;

export function buildExportDeepLink(context: ExportDeepLinkContext): string {
  const params = new URLSearchParams({ projectId: context.projectId });
  if (context.scoreId) {
    params.set("scoreId", context.scoreId);
  }
  if (context.expectedScoreRevisionId) {
    params.set("expectedScoreRevisionId", context.expectedScoreRevisionId);
  }
  if (context.songbookId) {
    params.set("songbookId", context.songbookId);
  }
  if (context.expectedSongbookRevisionId) {
    params.set(
      "expectedSongbookRevisionId",
      context.expectedSongbookRevisionId,
    );
  }
  return `${EXPORT_DEEP_LINK_PROTOCOL}://upload?${params.toString()}`;
}

/** `null` for anything not a well-formed link naming a project. */
export function parseExportDeepLink(url: string): ExportDeepLinkContext | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${EXPORT_DEEP_LINK_PROTOCOL}:`) {
    return null;
  }
  const projectId = parsed.searchParams.get("projectId");
  if (!projectId) {
    return null;
  }
  const get = (key: string) => parsed.searchParams.get(key) ?? undefined;
  return {
    projectId,
    scoreId: get("scoreId"),
    expectedScoreRevisionId: get("expectedScoreRevisionId"),
    songbookId: get("songbookId"),
    expectedSongbookRevisionId: get("expectedSongbookRevisionId"),
  };
}

/** Picks the deep link argument out of a process argv list, if any. */
export function findExportDeepLinkArg(argv: string[]): string | undefined {
  return argv.find((arg) =>
    arg.startsWith(`${EXPORT_DEEP_LINK_PROTOCOL}://`),
  );
}
