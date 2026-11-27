// The web send route's context and path (ticket 011). No database imports, so
// views can build links to it.
import type { UploadContext } from "../../types/exportDeepLink";
import { projectPath } from "./routes";

// The web route's query names (pt-BR, like the other routes) for each context field.
const QUERY_KEYS = {
  scoreId: "partitura",
  expectedScoreRevisionId: "versao",
  songbookId: "caderninho",
  expectedSongbookRevisionId: "versaoCaderninho",
  baseRevisionId: "base",
} as const;
// `modo=reformatar` reformats the `base` revision instead of sending a file (ticket 013).
const MODE_KEY = "modo";
const REFORMAT = "reformatar";
const CONTEXT_KEYS = Object.keys(QUERY_KEYS) as (keyof typeof QUERY_KEYS)[];

/** The web route's context: the project from the path, the rest from the query (untrusted, like a deep link). */
export function uploadContextFromSearchParams(projectId: string, params: URLSearchParams): UploadContext {
  const context: UploadContext = { projectId };
  for (const key of CONTEXT_KEYS) {
    const value = params.get(QUERY_KEYS[key]);
    if (value) {context[key] = value;}
  }
  // A reformat needs the score and the revision to reformat.
  if (params.get(MODE_KEY) === REFORMAT && context.scoreId && context.baseRevisionId) {context.mode = "reformat";}
  return context;
}

/** A context's query: everything but the project, which is in the path. */
function contextQuery(context: UploadContext): string {
  const params = new URLSearchParams();
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (value) {params.set(QUERY_KEYS[key], value);}
  }
  if (context.mode === "reformat") {params.set(MODE_KEY, REFORMAT);}
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** `/:slug/enviar?…` for a context. */
export function uploadPath(context: UploadContext): string {
  return `${projectPath(context.projectId)}/enviar${contextQuery(context)}`;
}

/**
 * `/:slug/exportador?…`: download the desktop Exportador, or open (or copy)
 * the link that starts this same upload in it.
 */
export function exporterPath(context: UploadContext): string {
  return `${projectPath(context.projectId)}/exportador${contextQuery(context)}`;
}

