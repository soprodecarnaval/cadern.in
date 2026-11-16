---
title: Separate public and member songbook routes
status: completed
type: feature
milestone: collab-flow
---

# 008 — Separate public and member songbook routes

## Objective

Public songbooks live at /project/:pid/songbook/:sbid; member views use a distinct protected route.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: medium-large. Dependencies: 004 (integrated: commit `29e33093`, see
[004's HANDOFF.md](../004-project-songbook-section/HANDOFF.md)). Execution
order: [workstreams](../WORKSTREAMS.md).

## Decisions (chat-approved, 2026-11-15)

- **Route params are the slug**, not an opaque id — "`:pid`" in the original
  requirement text means the project's slug, same as today's `:slug`.
- **Canonical prefix for the whole project namespace is singular**:
  `/project/:slug`, `/project/:slug/settings`,
  `/project/:slug/songbook/:songbookSlug` (public),
  `/project/:slug/songbook/:songbookSlug/manage` (member). `/manage` suffix
  approved as proposed.
- **No legacy redirects.** `/projects/:slug`, `/projects/:slug/settings`,
  `/projects/:slug/songbooks(/:songbookSlug)` and `/songbooks/:slug/:songbookSlug`
  are removed outright (404 via the existing catch-all), not redirected —
  collab-flow has never deployed, so there are no real bookmarks/shares to
  preserve. `/projects` (the "my projects" list) and `/projects/new` are
  unaffected; they aren't per-project routes.
- **Public route never upgrades for a signed-in member.** Visiting the public
  URL always renders the reader-only view, even for a project member — they
  reach the member workspace only via `/manage`, linked explicitly from the
  project page and from the public page's own denial state.

## Requirements

- Canonical project page: /project/:slug. Member songbook route:
  /project/:slug/songbook/:songbookSlug/manage.
- Project-page songbook links send project members to the member route and non-members to the public route.
- Member route checks membership of the songbook owning project before loading member-only data; logged-out and unrelated-project users cannot enter. Enforced in `firestore.rules` (pre-existing, unchanged by this task — reads of `songbooks`/`songbookRevisions` already gate on `isPublished`+current-revision for non-reviewers, full access for the owning project's reviewers) and in the UI (membership check gates the member view before it loads any data).
- Public route displays only published content without review history or member controls, even for signed-in members.
- ~~Redirect legacy routes~~ — superseded by the no-redirects decision above.

## Implementation

Wireframes approved: [mockup-v1.html](mockup-v1.html).

- `src/lib/songbook.ts`: `songbookPath`/`publicSongbookPath` repointed to the
  singular routes; added `projectPath`/`projectSettingsPath`.
- `SongbookPageView.tsx` split in two:
  - **`SongbookPageView`** (public): rewritten from scratch, reader-only.
    Loads only `songbook.currentRevisionId`, rejects anything not
    `isPublished`. No role, no `currentUser`, no query params.
  - **`SongbookManagePageView`** (new file, member): today's full workspace
    (edit, re-pin, publish, delete, history, score picker) unchanged, gated by
    a membership check at the top — `role === "loading"` shows a spinner,
    non-member shows a denial `Alert` linking back to the public route, before
    any member-only data loads.
- `App.tsx`: routes updated; `ProjectSongbooksPage.tsx` deleted (was a 004
  redirect adapter for a path that no longer exists under the no-redirects
  decision).
- Links updated across `PublicProjectPageView`, `MeusProjetosPageView`,
  `CreateProjectPageView`, `ScorePageView`, `ProjectSettingsPageView` (display
  text only), and `LandingPageView` — the last one was pointing its published-
  songbooks carousel at the *member* path unconditionally (pre-existing bug);
  now fixed to the public path, matching the carousel's own
  published-only content.
- Stories: `SongbookPage.stories.tsx` split into a slim public-view file and
  `SongbookManagePage.stories.tsx` (member); route params and asserted hrefs
  updated across `PublicProjectPage.stories.tsx` and
  `ProjectSettingsPage.stories.tsx`; the legacy-redirect story removed.

### Checks

- `tsc --noEmit`: clean on all non-`.stories.tsx` files; `.stories.tsx` errors
  are pre-existing (`@storybook/react`/`@storybook/test` not installed in this
  worktree — reproduced identically on an untouched stories file).
- `eslint` on every changed non-story file: clean.
- `vitest run`: 266/266 passing (demo Firebase env vars, no real project
  touched).
- `vite build`: not validated — this worktree's `node_modules` is missing
  `@fontsource/inter` (unrelated pre-existing gap, same build step B/004 ran
  as "demo-config app build"). Flagging as a limitation rather than silently
  skipping.
- No manual browser check (no emulator/dev server credentials in this
  environment); route/role logic covered by the Storybook story matrix above
  instead.

## Validation

Check anonymous, unrelated member and owning-project roles via direct links, refresh and navigation; reject unpublished public access and project/songbook ID mismatches.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None — resolved above.
