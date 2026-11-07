# 006 — Forks and lineage

**Goal:** A songbook can use any project's scores directly. Uploading an edited
copy of another project's score creates a fork under the target project, with
exact lineage read from the file.

**Depends on:** 001, 002, 004.

Spec: PLAN §2.2 (`forkedFrom`), §2.3 (`origin`), §4.3, §5.3, §5.5.

## Decisions

- **No links.** A songbook entry can be any score of any project, pinned to a
  version like every other entry. The `scoreLinks` model from 004a is gone.
- **Identity lives in the file.** Each uploaded `.mscz` is stamped with its
  own score and version ids (`cadernin-score-id`, `cadernin-revision-id`
  `metaTag`s); MuseScore keeps them when re-saving (checked with MuseScore 4). The
  export copies them to `.metajson` as `source`.
- **Forks are implicit.** The upload resolves its target from `source`, and the
  export app states the result before sending; there is nothing to choose.
- **Stamped on upload, plus a one-time backfill**, not on download: every `.mscz`
  cadern.in serves carries its ids, with no rewriting in the browser. The upload
  also stamps the user's own file.
- **`UploadPage` is gone**, so uploads only come from the export app.
  `MyScoresPage` stays, without its upload links.
- **Editors can swap a fork into a songbook** through a callable function: rules
  let editors change only pins and can't check a change to one list item.

## Steps

1. ✅ Links removed: schema, `db.ts`, rules, tests, save flow.
2. ✅ Songbook editor picker lists every live score of every live project, the
   project's own first.
3. ✅ `scripts/lib/msczIdentity.ts` (+ tests): read and stamp. The export writes
   `source` to `.metajson`; `parseUploadedFiles` exposes it.
4. ✅ `resolveUploadTarget` (+ tests), per PLAN §5.3. `uploadScore` takes the
   target, stamps the `.mscz`, and writes `forkedFrom` / `origin`.
5. ✅ `UploadPanel` shows the outcome and stamps the local file afterwards; failing
   to (file locked) is reported, not fatal.
6. ✅ Fork rule: the source exists, `forkedFrom.projectId` is its real project, and
   it isn't the fork's own (+ tests).
7. ✅ `ScoreLineage` on the score page: "derivada de …" and "derivações: …".
8. ✅ `swapSongbookEntryToFork` callable (+ emulator tests) and the songbook page's
   "derivação disponível" / "trocar pela derivação" (editors and up).
9. ✅ Migration `202610311200` stamps stored `.mscz` files in place, keeping their
   download tokens. Checked on the Storage emulator: the old URL still serves the
   file. Staging dry run ✓; ⏳ apply after deploy.

## Files

- `scripts/lib/msczIdentity.ts`, `scripts/lib/exportScore.ts`, `types/metajson.ts`
- `electron/ipc.ts`, `electron/preload.ts`, `src/export-app/`
- `src/lib/uploadTarget.ts`, `src/lib/uploadScore.ts`, `src/lib/parseUploadedFiles.ts`
- `src/tsx/ScoreLineage.tsx`, `src/tsx/ScorePage.tsx`, `src/tsx/SongbookPage.tsx`
- `functions/src/swapSongbookEntry.ts`
- `firestore.rules`, `scripts/migrations/`

## Acceptance

- Uploading a file downloaded from another project creates a fork at that exact
  version; uploading it again makes a new version of the fork.
- A retitled file still becomes a new version of its own score.
- An editor swaps a songbook entry to its fork without changing its number.
- Old stored `.mscz` URLs keep working after the backfill.
