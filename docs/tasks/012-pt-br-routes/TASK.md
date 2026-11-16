---
title: Rename application routes to pt-BR
status: open
type: refactor
milestone: ux-improvements
---

# 012 — pt-BR routes

## Objective

Use consistent Brazilian Portuguese paths across the application, preserving existing links through redirects.

## Placement and dependencies

Milestone: [UX improvements](../../milestones/ux-improvements/PLAN.md).
Depends on completion and integration of all three [workstreams](../WORKSTREAMS.md), including tasks 003–010, and task 011. Difficulty: large; broad compatibility surface. Executes after 011, outside A/B/C.

## Requirements

- Inventory all routes after the workstreams, including project, public/member songbook, songbook-scoped score review, builder, auth/account handlers and static page entry paths. Include website links, Storybook routes, redirects, emails, share URLs and exporter return/deep links.
- Propose and obtain approval for one English/current → pt-BR route table before implementation. Candidate nouns: projetos, cadernos and partituras; confirm terminology and singular/plural conventions. Existing Portuguese paths such as /montar need no arbitrary rename.
- Rename path segments, not stored IDs, project/songbook slugs, Firestore/Storage paths or third-party endpoints. Parameterize unchanged resource identifiers safely.
- Supersedes the English canonical routes specified by 008/009/010 only when this task lands; preserve their public/member separation and membership/data-access checks.
- Centralize route generation where useful so navigation, shared links and exporter launches use the same approved paths.
- Redirect existing application URLs to their canonical pt-BR equivalents without loops; preserve appropriate query parameters, hashes and explicit revision context. Never let a redirect expose member-only data or convert a private link into public access.
- Update website-to-exporter launch payloads, callbacks and packaged-app URL handling where affected. Plan compatibility with already released exporter versions and existing shared links; do not rename an OS protocol scheme without a separate approved compatibility plan.
- Inspect hosting rewrites and static entry pages to avoid breaking deployment, direct loading or reserved asset/API paths.
- Iterate on navigation/link wireframes with the user before implementation, including public/member, redirect and not-found states; record approved route/copy decisions here.

## Implementation plan

1. Inventory the integrated router, generated links, hosting/static entry points, external consumers and exporter route contracts.
2. Present the complete route mapping and compatibility plan, plus unresolved questions; iterate wireframes and obtain approval before code edits.
3. Implement canonical pt-BR routes and legacy redirects; update route helpers, links, stories, docs and affected exporter integration together.
4. Verify the route/role matrix and old-link compatibility, including packaged exporter behavior where paths change.

## Validation

- Exercise every canonical route and legacy alias via direct load, refresh and internal navigation.
- Cover signed-out, unrelated-project and owning-project roles; unpublished songbooks and scoped review remain protected.
- Verify revision/query/hash preservation, encoded IDs, invalid routes and redirect-loop avoidance.
- Check old share links, website/exporter launches, auth continuation, hosting rewrites and static pages.
- Run focused router/integration tests, type/lint/build and relevant Storybook checks.

## Unresolved questions

Approved route vocabulary/table? Legacy redirect lifetime? Exporter compatibility requirements?
