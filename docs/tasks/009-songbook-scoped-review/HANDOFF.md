# C/009 → C/010

Status: implemented, typechecked/linted; human review pending. All suites
green, re-verified on the merged tree under Java 21 (Homebrew `openjdk@21`):
rules 110/110, functions 20/20 (comment-copy test removed with the fork-swap
revert), migrations 26/26 — see TASK.md Checks.
Branch: `workstream/c-routes-review-uploads`. PR base: `main`.

## Contract

- Songbook-scoped score route: `/project/:slug/songbook/:songbookSlug/manage/score/:scoreId`.
  Membership-gated on the songbook's project; shows the songbook's pinned
  revision, not the score's latest.
- Comment thread path: `songbooks/{songbookId}/scoreThreads/{scoreId}_{revisionId}/comments/{commentId}`.
  `songbookScoreThreadId(scoreId, revisionId)` in `src/lib/db.ts` is the
  single source of truth for that key — 010's upload flow should use it too
  if it needs to know/predict a thread id.
- `db.ts` functions: `getSongbookComments`, `addSongbookComment`,
  `editSongbookComment`, `softDeleteSongbookComment` — same signatures as
  the score-scoped ones, plus a leading `songbookId`.
- Re-pin (same score, new revision, including a fork-swap) always starts an
  empty thread, automatically — no exception for fork-swap: carrying the
  old thread's comments over was tried and reverted (wrong anchor-safety
  assumption; see TASK.md Decisions, corrected 2026-11-16).

## Files / conflict boundary

- New: `SongbookScorePageView.tsx`, `SongbookScorePage.tsx`,
  `SongbookScorePage.stories.tsx`.
- `src/lib/db.ts`: new functions appended after the existing score-comment
  block; nothing existing changed.
- `src/lib/songbook.ts`: added `songbookScorePath`.
- `src/tsx/SongbookManagePageView.tsx`: `SongbookContents` gained a
  `songbookSlug` prop; only the entry title link's destination changed.
- `src/tsx/App.tsx`: one new route, nested under the existing `/manage` route.
- `firestore.rules`: new `scoreThreads` match block nested inside
  `songbooks/{songbookId}`, after `songbookRevisions`. Reuses
  `onlyUpdatingFields` (defined at file scope) and `isReviewer`/`songbookPath`
  already in use by the sibling block.
- `functions/src/swapSongbookEntry.ts`: unchanged from before this task.

## Validation

See TASK.md "Checks" — full detail on what ran (tsc, eslint, vitest) and
the emulator suites re-run under Java 21 (Homebrew `openjdk@21`): rules
110/110, functions 20/20, migrations 26/26.

## Coordination

010 (contextual exporter uploads) depends on this for the songbook-scoped
score page it launches "nova versão" from, and on `songbookScoreThreadId`
if it needs to reference a thread by the deep link's expected revision ids.
Not started yet.
