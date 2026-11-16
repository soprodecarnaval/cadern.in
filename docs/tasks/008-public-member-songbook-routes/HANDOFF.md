# C/008 → C/009

Status: implemented and typechecked/linted/tested in this worktree; human
review pending. Branch: `workstream/c-routes-review-uploads`. PR base: `main`
(repository has no `staging` branch; project CLAUDE.md overrides the global
default).

## Contract

- Canonical routes: `/project/:slug`, `/project/:slug/settings`,
  `/project/:slug/songbook/:songbookSlug` (public, reader-only),
  `/project/:slug/songbook/:songbookSlug/manage` (member workspace).
- `songbookPath(projectId, slug)` → member `/manage` URL;
  `publicSongbookPath(projectId, slug)` → public URL; `projectPath`/
  `projectSettingsPath` added alongside in `src/lib/songbook.ts`. 009 should
  reuse these rather than building paths inline.
- No legacy redirects exist for the old plural `/projects/:slug*` or
  `/songbooks/:slug/:songbookSlug` paths — they 404.
- Member membership check lives in `SongbookManagePageView` (top of the
  component, before any member-only data loads); public reader lives in the
  separate, now much smaller `SongbookPageView`. 009's songbook-scoped score
  route should follow the same pattern: membership check first, keyed off the
  *songbook's* `projectId`, not the score's.
- No rules changes in this task — `firestore.rules`' existing
  `songbooks`/`songbookRevisions` read rules already gate correctly on
  `isPublished`+current-revision vs. reviewer role of the owning project.

## Files / conflict boundary

- `src/lib/songbook.ts`: path helpers only, no logic changes.
- `SongbookPageView.tsx`: rewritten, public-only now (reader, no role/params).
- `SongbookManagePageView.tsx` (new): today's full member workspace, moved
  here verbatim plus the membership gate.
- `SongbookPage.tsx` / `SongbookManagePage.tsx`: thin containers.
- `App.tsx`: route table.
- `ProjectSongbooksPage.tsx`: deleted (dead after dropping legacy redirects).
- Link updates: `PublicProjectPageView`, `MeusProjetosPageView`,
  `CreateProjectPageView`, `ScorePageView`, `ProjectSettingsPageView` (display
  text), `LandingPageView` (also fixed a pre-existing bug: its published-
  songbooks carousel linked the member path unconditionally).
- Stories: `SongbookPage.stories.tsx` (new, public) +
  `SongbookManagePage.stories.tsx` (renamed from the old combined file).

## Validation

`tsc --noEmit` clean (excluding pre-existing `@storybook/*` module-resolution
errors, reproduced on an untouched file for comparison); `eslint` clean on
every changed non-story file; `vitest run` 266/266 passing with demo Firebase
env vars. `vite build` not validated — this worktree's `node_modules` is
missing `@fontsource/inter`, a pre-existing gap unrelated to this change. No
manual browser/emulator check (no dev credentials in this environment).

## Coordination

009 adds the songbook-scoped score route under `/manage` and the
`scoreThreads` schema (see [009's TASK.md](../009-songbook-scoped-review/TASK.md)
for the agreed design) — implementation not started yet, next stacked step.
