# 002 — Score revision model

**Goal:** Score revisions form an immutable linked list written transactionally,
each carrying the metadata of its mscz; the container caches the latest metadata
and admins can override it.

**Depends on:** 000. (Rules use the member-doc helpers from 001; if 002 lands
first, write them against the legacy map and switch in 001.)

Spec: PLAN §0 (dual-write), §2.2, §2.3, §4.3 (`scores`, `scoreRevisions`), §5.1, §5.2.

## Decisions

- **Existing revision ids are kept**; new ones are
  `${slugify(title)}-${YYYYMMDDTHHmmss}-${rand4}`.
- **No `isLatest` on `scoreRevisions`**; "latest" is the container's
  `latestRevisionId`. Revisions are never updated.
- **Display metadata = `metadataOverride[f] ?? cachedMetadata[f]`**, through one
  helper. No component reads score metadata fields directly.
- **Re-upload refreshes `cachedMetadata`**; an existing override still wins, which
  is what stops a stale export from resurrecting a corrected value
  (`TECH_DEBT.md`, "No way to correct score metadata").
- **Dual-write until launch** (PLAN §0): legacy `revisions` doc + `isLatest` flip +
  legacy score fields, so flag-off prod stays current.

## Steps

1. Schemas: revision `prevRevisionId`, `slug`, `metadata`, `origin` (no
   `isLatest`); container `cachedMetadata`, `metadataOverride?`, `forkedFrom?`,
   `published` (nullable; written only by 004's function, created as `null`).
   Legacy top-level `title/composer/sub/tags` stay optional until M9.
2. `uploadScore`: timestamp revision ids; container created first (unchanged);
   blobs; then `runTransaction` that reads `latestRevisionId`, creates the revision
   with `prevRevisionId`/`revisionNumber`, updates `latestRevisionId` +
   `cachedMetadata`, and dual-writes the legacy shape. Failure cleanup stays
   (allowed by the creator clause, PLAN §5.1).
3. `resolveScoreMetadata(score)` helper; wire `ScorePage`, `PublicProjectPage`,
   project score lists, songbook rows. (Homepage moves to songbooks in 004.)
4. Admin metadata override on `ScorePage` (title, composer, sub, tags), gated by
   `canEditMetadata`. Repurpose or remove `ScoreEditModal`, which today edits a
   songbook row in memory only.
5. Revision list on `ScorePage` walks the chain and shows uploader + date.
6. Rules: `scores` update clauses (editor pointer+cache, creator abandon, admin
   override, owner `deletedAt`); `scoreRevisions` create-only. Tests per clause.
7. Migrations M3 (`prevRevisionId`, `slug`, `origin`) and M4 (`metadata` on every
   revision, `cachedMetadata` and `published: null` on containers).
8. Release export app with the new upload path.

## Files

- `types/docs.ts`, `types/viewModels.ts`, `src/lib/db.ts`, `src/lib/uploadScore.ts`
- `src/lib/scoreMetadata.ts` (new)
- `src/tsx/ScorePage.tsx`, `src/tsx/ScoreEditModal.tsx`, `src/tsx/PublicProjectPage.tsx`
- `firestore.rules`, `tests/rules/`
- `scripts/migrations/` (M3, M4)

## Acceptance

- Two concurrent uploads of a new revision both persist, as consecutive links.
- A re-upload with a corrected composer shows the new composer unless an override
  is set.
- Editors cannot set `metadataOverride`; nobody can update a `scoreRevisions` doc
  (rules tests).
- After M3/M4 every revision has `metadata` and a valid `prevRevisionId` chain.
- Exporter uploads still appear on the flag-off homepage.
