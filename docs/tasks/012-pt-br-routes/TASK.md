---
title: Rename application routes to pt-BR
status: in-progress
type: refactor
milestone: ux-improvements
---

# 012 — pt-BR routes

## Objective

Use consistent Brazilian Portuguese paths across the application with GitHub-style
top-level project and songbook namespaces. Removed routes return not-found; there
are no aliases for legacy English paths.

## Placement and dependencies

Milestone: [UX improvements](../../milestones/ux-improvements/PLAN.md).
Depends on completion and integration of all three [workstreams](../WORKSTREAMS.md), including tasks 003–010, and task 011. Difficulty: large; broad compatibility surface. Executes after 011, outside A/B/C.

## Approved decisions

- GitHub-style namespaces: `/:projeto`, `/:projeto/:caderno`; the `/projetos` prefix is reserved for the project list/create flow.
- Nouns: `projetos`, `cadernos`, `partituras`.
- Project settings: `/:projeto/config`; member workspace: `/:projeto/:caderno/gerenciar`; explicit revision: `/partituras/:scoreId/versoes/:revisionId`.
- Keep `/montar` for the builder and `gerenciar` for the member workspace.
- **No legacy redirects or aliases.** Removed English and previous pt-BR URLs reach the existing not-found page.
- Year-only project slugs are permanently reserved. Four-digit paths redirect to the home page when they reach the SPA; the `/2026` static HTML page remains served until it is removed.
- Top-level reservations: `projetos`, `partituras`, `artigos`, `montar`, `plugin`, `assets`, static file names and removed route names. `config` is reserved as a songbook slug.
- Internal route parameter names stay unchanged (`slug`, `songbookSlug`, `scoreId`, `revisionId`).
- Route builders, patterns and reserved-slug helpers live in `src/lib/routes.ts`; UI copy and stories use the same builders.

| Current | Canonical pt-BR |
|---|---|
| `/projects` | `/projetos` |
| `/projects/new` | `/projetos/novo` |
| `/project/:slug` | `/:projeto` |
| `/project/:slug/settings` | `/:projeto/config` |
| `/project/:slug/songbook/:songbookSlug` | `/:projeto/:caderno` |
| `…/songbook/:songbookSlug/manage` | `/:projeto/:caderno/gerenciar` |
| `…/manage/score/:scoreId` | `/:projeto/:caderno/gerenciar/partituras/:scoreId` |
| `/score/:scoreId` | `/partituras/:scoreId` |
| `/score/:scoreId/:revisionId` | `/partituras/:scoreId/versoes/:revisionId` |

Unchanged: `/`, `/montar`, `/artigos`, `/artigos/:slug`, `/#exportador`.

All four-digit top-level paths are year-only reservations. `/2026` keeps serving
the checked-in static page; when it reaches the SPA it redirects to `/`.

## Requirements

- Inventory all routes after the workstreams, including project, public/member songbook, songbook-scoped score review, builder, auth/account handlers and static page entry paths. Include website links, Storybook routes, redirects, emails, share URLs and exporter return/deep links.
- Propose and obtain approval for one English/current → pt-BR route table before implementation. Candidate nouns: projetos, cadernos and partituras; confirm terminology and singular/plural conventions. Existing Portuguese paths such as /montar need no arbitrary rename.
- Rename path segments, not stored IDs, project/songbook slugs, Firestore/Storage paths or third-party endpoints. Parameterize unchanged resource identifiers safely.
- Supersedes the English canonical routes specified by 008/009/010; preserve their public/member separation and membership/data-access checks.
- Centralize route patterns and generation so navigation, shared links, stories and exporter launches use the same approved paths.
- Do **not** add legacy redirects or aliases. Old application URLs reach the not-found route. Never add a route that could bypass member-only checks.
- Update website-to-exporter launch payloads, callbacks and packaged-app URL handling where affected. Plan compatibility with already released exporter versions and existing shared links; do not rename an OS protocol scheme without a separate approved compatibility plan.
- Inspect hosting rewrites and static entry pages to avoid breaking deployment, direct loading or reserved asset/API paths.
- Reserve top-level names and four-digit years so project slugs cannot shadow static files or application routes; reserve `config` so songbooks cannot shadow project settings.
- Navigation appearance is unchanged; review uses the approved route matrix, redirect/404 behavior and existing public/member/not-found stories.

## Implementation plan

1. Inventory the integrated router, generated links, hosting/static entry points, external consumers and exporter route contracts.
2. Present the complete route mapping and compatibility plan, plus unresolved questions; obtain approval before code edits.
3. Implement canonical pt-BR routes and remove English aliases; update route helpers, links, stories, docs and affected exporter integration together.
4. Verify the route/role matrix and direct-load behavior for canonical routes and the 404 path for removed URLs, including packaged exporter behavior where paths change.

## Validation

- Exercise every canonical route via direct load, refresh and internal navigation.
- Cover signed-out, unrelated-project and owning-project roles; unpublished songbooks and scoped review remain protected.
- Verify query parameters, hashes, encoded IDs, invalid routes and that removed English paths reach not-found.
- Check share links, website/exporter launches, auth continuation, hosting rewrites and static pages.
- Run focused route tests, type/lint/build and relevant Storybook checks.

## Unresolved questions

None blocking. Route vocabulary and the no-redirect policy are approved.

## Implementation record

Canonical GitHub-style routes are defined once in `src/lib/routes.ts`. Path
builders moved out of `src/lib/songbook.ts`; navigation, landing, projects,
songbooks, scores and Storybook route parameters use the shared builders and
patterns. The router has no English or previous pt-BR aliases: removed URLs
reach the not-found page.

Top-level project slugs are guarded against static/app routes, removed route
names and all four-digit years. Songbooks cannot use `config`. Creation is
validated in the forms, domain functions and Firestore rules. Four-digit SPA
paths redirect to `/`; `/2026` remains a static page served by the checked-in
HTML.

Exporter deep links remain ID-based (`cadernin-export://upload?...`); no payload,
protocol or Electron handler changed. Hosting keeps the catch-all SPA rewrite;
`/2026/`, `/plugin/` and `/plugin/tutorial.html` still resolve as static files.

Validation: route unit tests pass; all 183 Storybook stories pass; app and
Storybook builds pass; typecheck/lint/whitespace pass. Browser checks loaded all
GitHub-style canonical routes, confirmed removed paths reach not-found, and
confirmed year-only paths redirect while `/2026` stays static in the production
preview.
