---
title: Rename application routes to pt-BR
status: in-progress
type: refactor
milestone: ux-improvements
---

# 012 — pt-BR routes

## Objective

Use consistent Brazilian Portuguese paths across the application, preserving existing links through redirects.

## Placement and dependencies

Milestone: [UX improvements](../../milestones/ux-improvements/PLAN.md).
Depends on completion and integration of all three [workstreams](../WORKSTREAMS.md), including tasks 003–010, and task 011. Difficulty: large; broad compatibility surface. Executes after 011, outside A/B/C.

## Approved decisions

- Nouns: `projetos`, `cadernos`, `partituras`; singular collection resource paths under `/projetos`.
- Member workspace suffix: `gerenciar`; settings: `configuracoes`; create project: `/projetos/novo`.
- Explicit score revision path: `/partituras/:scoreId/versoes/:revisionId`.
- **No legacy redirects or aliases.** Removed English URLs reach the existing not-found page.
- Internal route parameter names stay unchanged (`slug`, `songbookSlug`, `scoreId`, `revisionId`).
- Route builders and patterns live in `src/lib/routes.ts`; UI copy uses the same builders.

| Current | Canonical pt-BR |
|---|---|
| `/projects` | `/projetos` |
| `/projects/new` | `/projetos/novo` |
| `/project/:slug` | `/projetos/:slug` |
| `/project/:slug/settings` | `/projetos/:slug/configuracoes` |
| `/project/:slug/songbook/:songbookSlug` | `/projetos/:slug/cadernos/:songbookSlug` |
| `…/songbook/:songbookSlug/manage` | `…/cadernos/:songbookSlug/gerenciar` |
| `…/manage/score/:scoreId` | `…/gerenciar/partituras/:scoreId` |
| `/score/:scoreId` | `/partituras/:scoreId` |
| `/score/:scoreId/:revisionId` | `/partituras/:scoreId/versoes/:revisionId` |

Unchanged: `/`, `/montar`, `/artigos`, `/artigos/:slug`, `/#exportador`.

## Requirements

- Inventory all routes after the workstreams, including project, public/member songbook, songbook-scoped score review, builder, auth/account handlers and static page entry paths. Include website links, Storybook routes, redirects, emails, share URLs and exporter return/deep links.
- Propose and obtain approval for one English/current → pt-BR route table before implementation. Candidate nouns: projetos, cadernos and partituras; confirm terminology and singular/plural conventions. Existing Portuguese paths such as /montar need no arbitrary rename.
- Rename path segments, not stored IDs, project/songbook slugs, Firestore/Storage paths or third-party endpoints. Parameterize unchanged resource identifiers safely.
- Supersedes the English canonical routes specified by 008/009/010; preserve their public/member separation and membership/data-access checks.
- Centralize route patterns and generation so navigation, shared links, stories and exporter launches use the same approved paths.
- Do **not** add legacy redirects or aliases. Old application URLs reach the not-found route. Never add a route that could bypass member-only checks.
- Update website-to-exporter launch payloads, callbacks and packaged-app URL handling where affected. Plan compatibility with already released exporter versions and existing shared links; do not rename an OS protocol scheme without a separate approved compatibility plan.
- Inspect hosting rewrites and static entry pages to avoid breaking deployment, direct loading or reserved asset/API paths.
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

Canonical routes are defined once in `src/lib/routes.ts`. Path builders moved
out of `src/lib/songbook.ts`; navigation, landing, projects, songbooks, scores
and Storybook route parameters use the shared builders/patterns. The router has
no English aliases: removed URLs reach the not-found page.

Exporter deep links remain ID-based (`cadernin-export://upload?...`); no payload,
protocol or Electron handler changed. Hosting keeps the catch-all SPA rewrite;
`/2026/`, `/plugin/` and `/plugin/tutorial.html` still resolve as static files.

Validation: route unit tests pass; all 183 Storybook stories pass; app,
exporter and Storybook builds pass; typecheck/lint/whitespace pass. Browser
checks loaded all 13 canonical routes and confirmed 9 removed English paths
reach not-found, including songbook, scoped-score and revision URLs.
