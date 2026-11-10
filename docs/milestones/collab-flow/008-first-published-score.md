# 008 — First-published score

**Goal:** Replace "owning project" as a score's displayed origin, everywhere it
appears (score cards, the lineage view), with a historical fact: the first
songbook that ever published the score, and when. This doc covers the data
layer only; the UI consuming the new field is a separate, unblocked workstream.

**Depends on:** 004 (songbooks, `scores.published`).

## Problem

`ScoreData.published` (`functions/src/publishedScores.ts`) is a **live cache**:
it is recomputed from scratch on every songbook/score/project write that could
affect it, and overwritten unconditionally (`recomputePublished`). It answers
"who publishes this right now", not "who published this first". Once a
songbook unpublishes, is deleted, or re-pins a different revision, any trace
of the earlier fact is gone — there is nothing to fall back on.

## Decisions

- **New field `ScoreData.firstPublished`**:
  ```ts
  { songbookId: string; projectId: string; publishedAt: Timestamp } | null
  ```
  Lives on `scores/{id}` next to `published`. `projectId` is denormalized
  (the owning project of the songbook) so the UI never has to join against
  `songbooks` to show it.
- **Write-once, never overwritten.** Once set, no code path updates or clears
  it — not on unpublish, not on re-pin, not on soft-delete/restore of the
  score, songbook or project. This is a deliberate asymmetry with `published`:
  `firstPublished` is a historical fact, `published` stays a live cache.
- **Trigger point:** `recomputePublished` (shared by all three
  `syncPublishedScoresOn*` functions and `rebuildPublished`). Right before
  writing the new `published` marker, if `after !== null` and the score's
  current doc has no `firstPublished` yet, it is set in the same `update()`
  call. This piggybacks on the exact moment a score is *observed* to become
  published — no new trigger wiring needed.
  - Among the songbooks currently publishing the score (`matches`), the one
    whose **current revision** has the earliest `createdAt` is credited. This
    is a simple, cheap heuristic (no extra reads beyond what `recomputePublished`
    already does) — see "Known limitation" below for why it isn't perfectly
    "first" in all cases.
  - `publishedAt` is `Timestamp.now()` at write time — the actual moment this
    service observed the transition, which going forward is exact (no
    reconstruction needed).
- **Dry runs never write it.** `recomputePublished({ dryRun: true })` reports
  what *would* change (including `rebuildPublished`'s dry-run report) without
  touching `firstPublished`, exactly like it already does for `published`.

## Known limitation (write-once logic)

The "earliest current revision" heuristic only considers songbooks that are
*currently* matching candidates in that one `recomputePublished` call — not a
songbook's full revision history. In the rare case where a score transitions
from unpublished→published via two songbooks in the *same* call (e.g. a
project restore that simultaneously reinstates two songbooks' pins), and one
songbook's current-revision-at-that-moment is newer than the other's but that
other songbook actually pinned the score earlier in a now-superseded
revision, the credited songbook could in theory be "wrong" by that stricter
reading. Accepted: reconstructing full cross-songbook revision history on
every write is unjustified cost for a corner case this narrow, and the
field's purpose (display, not audit) tolerates it.

## Backfill migration

**Scope and honesty check:** there is no history of `isPublished` toggles —
it's a plain boolean on the current `songbooks/{id}` doc, never revisioned.
So for any score, we can know *whether* a songbook is published **now**, but
never whether it was published at some point in the past.

**Decision (resolves the open question below): treat every score as
published for backfill purposes.** A songbook's current `isPublished` value
is ignored entirely; credit is based only on which songbook's revision
history pinned the score earliest, full stop. This deliberately over-claims
in one direction (a songbook that pinned a score early but was never
actually published gets credited as if it had been) in exchange for never
under-claiming — every score that was ever pinned by any songbook ends up
with a `firstPublished`, instead of only the subset currently published. The
"proof" caveat on `publishedAt` still applies (see Decisions above): it's a
proxy for "earliest known pin", not a verified publish date.

**Algorithm** (`scripts/migrations/202611101500_first_published_backfill.ts`):

1. Scan **every songbook's entire `songbookRevisions` history** (current
   `isPublished` ignored) and build a map from score id to the earliest
   revision (by `createdAt`) whose `pins` include it, across all songbooks.
2. For every score without a `firstPublished` yet, look it up in that map
   and write `{ songbookId, projectId, publishedAt: <that revision's
   createdAt> }`. A score absent from the map (never pinned by any songbook,
   ever) is left `firstPublished: null` — there's nothing to credit.
3. Scores already carrying `firstPublished` (re-run, or the live trigger got
   there first) are skipped; write-once applies here too.

This is a **schema migration** (dry-run by default via the existing
`scripts/migrations/migrate.ts` runner), registered in
`scripts/migrations/index.ts`. `down()` clears `firstPublished` back to
unset (`FieldValue.delete()`) — acceptable since it's purely a derived/display
field, not something anything else depends on.

## Open questions

- ~~Should scores that are not currently published get a best-effort
  backfill too?~~ **Resolved:** yes — see Decision above. Every score gets
  backfilled from whichever songbook's history pinned it earliest,
  regardless of that songbook's current publish state.
- `publishedAt` precision for backfilled records is inherently an
  approximation. If that's unacceptable for the "first published on this
  date" messaging, product should decide whether to display it with lower
  precision (e.g. "antes de X") for backfilled entries vs. exact for ones
  computed going forward. No field currently distinguishes backfilled from
  observed entries — easy to add (`source: "backfill" | "observed"`) if
  needed later.

## Files

- `types/docs.ts`: `firstPublished` on `zScoreData`.
- `functions/src/publishedScores.ts`: write-once in `recomputePublished`.
- `functions/test/publishedScores.test.ts`: write-once coverage.
- `scripts/migrations/202611101500_first_published_backfill.ts` (+ registered
  in `scripts/migrations/index.ts`).

## Acceptance

- A score newly published gets `firstPublished` set once, matching the
  songbook crediting it.
- Unpublishing, re-pinning, or publishing from a second songbook never
  changes an already-set `firstPublished`.
- The backfill migration is idempotent, dry-run safe, and leaves
  `firstPublished: null` for scores with no reliable historical signal rather
  than guessing.
