# C/009 → C/010

Status: implemented, typechecked/linted; human review pending. Rules and
Cloud Functions tests written but unexecuted (Firestore emulator needs Java
21, only Java 17 available in this environment — see TASK.md Checks).
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
- Re-pin (same score, new revision) still starts an empty thread,
  automatically. Fork-swap copies the old thread's comments into the new
  one, inside the same transaction as the pin change
  (`functions/src/swapSongbookEntry.ts`).

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
- `functions/src/swapSongbookEntry.ts`: comment-copy logic inserted between
  the pin computation and the new-revision write, inside the existing
  transaction — no new transaction, no new Cloud Function.

## Validation

See TASK.md "Checks" — full detail on what ran (tsc, eslint, vitest 277/277)
and what's written-but-unexecuted (rules tests, functions tests) and why
(no Java 21 in this environment for the Firestore emulator).

## Coordination

010 (contextual exporter uploads) depends on this for the songbook-scoped
score page it launches "nova versão" from, and on `songbookScoreThreadId`
if it needs to reference a thread by the deep link's expected revision ids.
Not started yet.
