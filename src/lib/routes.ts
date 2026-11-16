/**
 * Canonical application routes. Keep path generation here so navigation,
 * shared links, stories and copy cannot drift from the router.
 */
export const ROUTE_PATTERNS = {
  home: "/",
  builder: "/montar",
  articles: "/artigos",
  article: "/artigos/:slug",
  score: "/partituras/:scoreId",
  scoreRevision: "/partituras/:scoreId/versoes/:revisionId",
  projects: "/projetos",
  newProject: "/projetos/novo",
  project: "/projetos/:slug",
  projectSettings: "/projetos/:slug/configuracoes",
  publicSongbook: "/projetos/:slug/cadernos/:songbookSlug",
  songbook: "/projetos/:slug/cadernos/:songbookSlug/gerenciar",
  songbookScore:
    "/projetos/:slug/cadernos/:songbookSlug/gerenciar/partituras/:scoreId",
} as const;

export const articlesPath = () => ROUTE_PATTERNS.articles;

export const articlePath = (slug: string) =>
  `${ROUTE_PATTERNS.articles}/${encodeURIComponent(slug)}`;

export const projectsPath = () => ROUTE_PATTERNS.projects;

export const newProjectPath = () => ROUTE_PATTERNS.newProject;

export const projectPath = (projectSlug: string) =>
  `${ROUTE_PATTERNS.projects}/${encodeURIComponent(projectSlug)}`;

export const projectSettingsPath = (projectSlug: string) =>
  `${projectPath(projectSlug)}/configuracoes`;

/** Short, shareable URL of a songbook. */
export const publicSongbookPath = (projectSlug: string, songbookSlug: string) =>
  `${projectPath(projectSlug)}/cadernos/${encodeURIComponent(songbookSlug)}`;

/** Member workspace: edit, re-pin, publish, history, delete. */
export const songbookPath = (projectSlug: string, songbookSlug: string) =>
  `${publicSongbookPath(projectSlug, songbookSlug)}/gerenciar`;

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
