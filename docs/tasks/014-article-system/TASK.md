---
title: Replace hardcoded articles with a managed article system
status: open
type: feature
milestone: ux-improvements
---

# 014 — Managed article system

## Objective

Move articles out of source code and checked-in media into a proper publishing
system, so authors can create, preview and publish articles without a deploy.

## Placement and dependencies

Milestone: [UX improvements](../../milestones/ux-improvements/PLAN.md).
Depends on [PR #443](https://github.com/soprodecarnaval/cadern.in/pull/443)
landing the current article pages and [011 — Design system](../011-design-system-foundations/TASK.md).
Independent of [012 — pt-BR routes](../012-pt-br-routes/TASK.md) and
[013 — Exporter stories](../013-exporter-stories/TASK.md). Difficulty: large.

## Current state

PR #443 introduces `src/articles.ts` with a hardcoded `Article[]`, placeholder
cards, search/filter helpers and article routes under `/artigos`. It also checks
article photos into `public/assets/articles/`. Placeholder cards reference image
files that are not present. This is the temporary baseline to replace.

## Requirements

- Choose and document one source of truth: Firestore + Storage, a repository-
  managed content pipeline, or a headless CMS. Compare authoring effort,
  preview, media handling, caching, cost, backups and deployment. Obtain user
  approval before implementation.
- Define an article model covering slug, kicker, title, deck, author, publish
  date, source attribution, lead image, ordered body blocks (`paragraph`,
  `heading`, `quote`, `figure`), status, timestamps and author/editor identity.
  Keep rich text limited to the existing bold/link syntax unless a broader
  format is approved.
- Store images outside the repository with responsive variants, intrinsic
  dimensions, alt text and captions. Enforce file type and size limits. Remove
  `public/assets/articles/` and all hardcoded image paths after migration.
- Support draft, preview and published states. Preview must not expose drafts
  publicly. Publish/unpublish must not require a deploy. Define who may author,
  edit and publish; enforce this in backend rules or the publishing pipeline.
- Keep the public `/artigos` list, home Articles section and `/artigos/:slug`
  pages backed by published content only. Preserve search, section filters,
  ordering, responsive images, not-found handling and article SEO metadata.
- Migrate the existing Wanda article and any placeholder cards. Preserve live
  slugs and shared links; add redirects if the slug model changes. Delete the
  hardcoded exports and placeholder data once migration is verified.
- Replace Storybook article fixtures with injected data. Stories must not read
  Firestore, Storage or a CMS. Cover list, empty, loading, error, filtered,
  signed-in and article-body states.
- Define caching and invalidation for lists, home cards and article pages.
  Avoid stale unpublished content and excessive reads.

## Implementation plan

1. Inventory #443's content model, routes and assets; compare storage options
   and settle permissions, preview and media processing. Present the decision
   and unresolved questions for approval.
2. Design the schema, migration and authoring flow. Iterate wireframes for the
   editor, preview, publish confirmation and public error/loading states.
3. Implement the content backend, authorization, image upload/variants and read
   path, including rules and indexes.
4. Build the authoring/publishing surface and migrate existing content and
   images. Remove hardcoded articles and checked-in article media.
5. Integrate public list/home/article reads, SEO and cache invalidation; update
   Storybook fixtures and stories.
6. Validate rules, migration, keyboard access, responsive layouts, image
   fallbacks, links and deployment behavior.

## Validation

- Drafts are invisible to signed-out users and non-editors through every read
  path, including direct URLs, search and home cards.
- Authors can create, preview, publish, unpublish and correct an article
  without a deploy; image upload validates type, size and alt text.
- Existing article URLs and image URLs either keep working or redirect.
- Public pages handle missing, unpublished and deleted articles without leaking
  metadata.
- Article images render responsively with correct dimensions and captions.
- Firestore/Storage rules tests, migration checks, type/lint/build, SEO checks
  and relevant Storybook browser checks pass.
- Repository builds contain no article image binaries and no hardcoded article
  bodies.

## Unresolved questions

Firestore + Storage, repo-managed content, or CMS? Who can publish? Draft preview
links needed? Image processing in a Function or at upload? Migrate or drop the
placeholder cards? Scheduling, translations or comments in scope?
