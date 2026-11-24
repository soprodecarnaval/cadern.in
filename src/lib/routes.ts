/**
 * Canonical application routes. Keep path generation here so navigation,
 * shared links, stories and copy cannot drift from the router.
 */
export const ROUTE_PATTERNS = {
  home: "/",
  builder: "/montar",
  library: "/biblioteca",
  articles: "/artigos",
  contribute: "/contribua",
  about: "/sobre",
  help: "/ajuda",
  article: "/artigos/:slug",
  score: "/partituras/:scoreId",
  scoreRevision: "/partituras/:scoreId/versoes/:revisionId",
  projects: "/projetos",
  newProject: "/projetos/novo",
  project: "/:slug",
  projectSettings: "/:slug/config",
  upload: "/:slug/enviar",
  publicSongbook: "/:slug/:songbookSlug",
  songbook: "/:slug/:songbookSlug/gerenciar",
  songbookScore: "/:slug/:songbookSlug/gerenciar/partituras/:scoreId",
} as const;

// Top-level names that must never become project slugs. Static files/directories
// and application routes both win over the dynamic /:slug route, so a project
// with one of these names would be unreachable.
const RESERVED_PROJECT_SLUGS = new Set([
  "projetos",
  "partituras",
  "artigos",
  "contribua",
  "sobre",
  "ajuda",
  "montar",
  "biblioteca",
  "plugin",
  "assets",
  // Engine assets for in-browser rendering (scripts/browserScore/assets.mjs).
  "browser-score",
  "index.html",
  "vite.svg",
  "soundfont-player.min.js",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  // Removed English routes stay unreachable instead of becoming projects.
  "projects",
  "project",
  "score",
  "songbook",
  "manage",
  "settings",
]);

// Project routes occupy the second segment, so a songbook cannot use a name
// that is also a project-level route.
const RESERVED_SONGBOOK_SLUGS = new Set(["config", "enviar"]);

export const YEAR_ONLY_SLUG = /^\d{4}$/;

export function isYearOnlySlug(slug: string | undefined): boolean {
  return slug !== undefined && YEAR_ONLY_SLUG.test(slug);
}

export function isReservedProjectSlug(slug: string | undefined): boolean {
  return slug !== undefined &&
    (isYearOnlySlug(slug) || RESERVED_PROJECT_SLUGS.has(slug));
}

export function isReservedSongbookSlug(slug: string | undefined): boolean {
  return slug !== undefined && RESERVED_SONGBOOK_SLUGS.has(slug);
}

export const libraryPath = () => ROUTE_PATTERNS.library;

export const articlesPath = () => ROUTE_PATTERNS.articles;

export const contributePath = () => ROUTE_PATTERNS.contribute;

export const aboutPath = () => ROUTE_PATTERNS.about;

export const helpPath = () => ROUTE_PATTERNS.help;

export const articlePath = (slug: string) =>
  `${ROUTE_PATTERNS.articles}/${encodeURIComponent(slug)}`;

export const projectsPath = () => ROUTE_PATTERNS.projects;

export const newProjectPath = () => ROUTE_PATTERNS.newProject;

export const projectPath = (projectSlug: string) =>
  `/${encodeURIComponent(projectSlug)}`;

export const projectSettingsPath = (projectSlug: string) =>
  `${projectPath(projectSlug)}/config`;

/** Short, shareable URL of a songbook. */
export const publicSongbookPath = (projectSlug: string, songbookSlug: string) =>
  `${projectPath(projectSlug)}/${encodeURIComponent(songbookSlug)}`;

/** Member workspace: edit, re-pin, publish, history, delete. */
export const songbookPath = (projectSlug: string, songbookSlug: string) =>
  `${publicSongbookPath(projectSlug, songbookSlug)}/gerenciar`;

export const songbookEditPath = (projectSlug: string, songbookSlug: string) =>
  `${songbookPath(projectSlug, songbookSlug)}?detalhes&editar`;

/** Review for one entry's pinned revision, scoped to this songbook (009). */
export const songbookScorePath = (
  projectSlug: string,
  songbookSlug: string,
  scoreId: string,
) =>
  `${songbookPath(projectSlug, songbookSlug)}/partituras/${encodeURIComponent(scoreId)}`;

export const scorePath = (scoreId: string) =>
  `/partituras/${encodeURIComponent(scoreId)}`;

export const scoreRevisionPath = (scoreId: string, revisionId: string) =>
  `${scorePath(scoreId)}/versoes/${encodeURIComponent(revisionId)}`;
