# 009 — Project-required uploads, no more Acervo

**Goal:** Every score still belongs to a project — no change to that part of
the model — but the auto-created "Acervo @<name>" project is gone. It existed
only so a new user always had somewhere to upload to, and its slug derived
from the user's (sometimes transiently blank, sometimes later renamed)
displayName; two calls observing a different name created two different
"Acervo" projects for the same person. Replaced with letting the user create
a project inline, right where the need shows up: the export app's upload
picker.

**Depends on:** 001 (members/roles), 002 (score revisions).

## Decisions

- **No personal/project-less scores.** An earlier direction explored letting
  scores be owned directly by a user instead of a project (see the abandoned
  `feat/personal-scores` branch) — reset in favor of this simpler fix once it
  became clear that direction's songbook-saving flow would need songbooks to
  also become project-less, which is a much larger, separate migration
  (songbook ids, URLs and rules are all project-keyed). Scores stay
  project-only; only the *auto-creation* of a default project is removed.
- **Inline project creation in the upload picker**, not a separate "new
  project" page detour. `UploadPanel`'s project `<select>` always carries a
  trailing "Criar novo projeto…" option; choosing it swaps the select for a
  name field + "Criar projeto" button, reusing `createProject` +
  `getProjectBySlug` collision check from `CreateProjectPageView`. A user
  with zero projects skips the picker and opens straight into this form.
- **`SaveSongbookModalView`** (save-from-homepage-builder) gets the same
  removal of the Acervo default, but *not* inline creation — it already links
  out to `/projects/new` for a user with no project, which is an acceptable
  detour for a less frequent action than exporting.
- **"Minhas partituras" removed.** It listed scores by `uploadedBy`,
  independent of project — a page made possible only because scores could
  already be queried that way, not because it reflected the ownership model.
  With no personal scores, every score is reachable from its project page,
  so the separate listing is redundant. `getUserScores` (the query backing
  it) removed too, since nothing else used it.

## Steps

1. `src/lib/uploadScore.ts`: delete `getOrCreateDefaultProject` and
   `defaultProjectTitle`.
2. `src/export-app/components/UploadPanel.tsx`: project `<select>` + a
   sentinel "create new" option; inline create form (title input, collision
   check via `getProjectBySlug`, `createProject`, select the result). Opens
   directly in create mode when the user has no projects yet.
3. `src/tsx/SaveSongbookModalView.tsx`: drop the Acervo default; empty-state
   message linking to `/projects/new` when the user administers no project.
4. Remove `src/tsx/MyScoresPage(View).tsx`, its stories, the `/my-scores`
   route, the nav link, and `getUserScores` from `src/lib/db.ts`.

## Files

- `src/lib/uploadScore.ts`
- `src/export-app/components/UploadPanel.tsx`, `src/export-app/index.css`
- `src/tsx/SaveSongbookModal.tsx`, `src/tsx/SaveSongbookModalView.tsx`
- `src/tsx/App.tsx`, `src/tsx/AppNavigation.tsx`
- `src/lib/db.ts`

## Acceptance

- A brand-new user, zero projects: the export app's upload panel opens
  directly into "create a project," no empty picker, no silent Acervo.
- A user with existing projects sees them in the picker, with "criar novo
  projeto…" always last, never pre-selected.
- Saving a songbook from the homepage builder with no project prompts to
  create one instead of silently creating/reusing an Acervo.
- No `/my-scores` route, no nav link; existing score/project URLs unaffected.
