# 002 — Score revision model

**Goal:** Score revisions form an immutable linked list written transactionally,
each carrying the metadata of its mscz; the container caches the latest metadata
and admins can override it.

**Depends on:** 000, 001.

Spec: PLAN §0 (dual-write), §2.2, §2.3, §4.3 (`scores`, `scoreRevisions`), §5.1, §5.2.

## Decisions

- **Existing revision ids are kept**; new ones are
  `${slugify(title)}-${YYYYMMDDTHHmmss}-${rand4}` (`src/lib/revisionId.ts`).
- **No `isLatest` on `scoreRevisions`**; "latest" is the container's
  `latestRevisionId`. Revisions are never updated.
- **Display metadata = `metadataOverride[f] ?? cachedMetadata[f] ?? legacy[f]`**,
  through `resolveScoreMetadata`. No component reads score metadata fields directly.
- **Re-upload refreshes `cachedMetadata`**; an existing override still wins, which
  is what stops a stale export from resurrecting a corrected value
  (`TECH_DEBT.md`, "No way to correct score metadata").
- **Dual-write until launch** (PLAN §0): both revision subcollections get the same
  data (legacy also `isLatest`), and the container its legacy metadata fields.
- **Reads stay on the legacy `revisions` subcollection until the launch (007)**:
  older export-app builds write only `revisions`. One switch, at launch.
- **New fields are optional in zod** until M9: flag-off prod parses score docs
  with the same build, before M3/M4 have backfilled them.
- **`ScoreEditModal` stays as is**: it is the songbook builder's per-PDF edit and
  never persisted. The admin override is a separate editor on the score page.
- **Revision list and override editor are flag-on only.** Uploaders who are no
  longer members show as `UNKNOWN_UPLOADER` (`"—"`, `ScoreRevisionList.tsx`).
- **Old revisions' `metadata` comes from the current score fields** — no history
  exists.

## Steps

1. ✅ Schemas: revision `prevRevisionId`, `slug`, `metadata`, `origin`
   (`zNewScoreRevisionData` requires them on write); container `cachedMetadata`,
   `metadataOverride`, `forkedFrom`, `published`.
2. ✅ `uploadScore` → `commitScoreRevision`: one `runTransaction` that reads the
   container, links to `latestRevisionId`, numbers the revision, writes both
   subcollections, flips the legacy `isLatest` and updates the container. Fixes the
   `length + 1` race and the re-upload metadata bug.
3. ✅ `resolveScoreMetadata` / `uploadedScoreMetadata`; wired into
   `CollectionContext`, `ScorePage`, `PublicProjectPage`, `MyScoresPage`.
4. ✅ `ScoreMetadataEditor` on `ScorePage` (admins): stores only fields that differ
   from the upload; per-field "restaurar".
5. ✅ `ScoreRevisionList` on `ScorePage`: number, date, uploader, current marked.
6. ✅ Rules: `scores` create (own upload, empty pointer, `published == null`);
   update clauses — editor pointer + metadata only with the new revision committed
   alongside, creator abandon while empty, admin `metadataOverride`, owner
   `deletedAt`; `scoreRevisions` create must extend the chain (prev = current
   latest, becomes latest in the same commit); legacy `revisions` update only
   `isLatest`. Tests per clause.
7. ✅ Migrations `202610081300` M3 (`prevRevisionId` by `revisionNumber`, `slug`,
   `origin`) and `202610081301` M4 (`metadata` on revisions, `cachedMetadata` and
   `published: null` on scores), both subcollections. Applied on staging ✓.
8. ⏳ After deploy: prod migrations, then release the export app — older builds
   can no longer upload (their revisions don't extend the chain).

## Files

- `types/docs.ts`, `src/lib/db.ts`, `src/lib/uploadScore.ts`
- `src/lib/revisionId.ts`, `src/lib/scoreMetadata.ts` (+ tests)
- `src/tsx/ScorePage.tsx`, `src/tsx/ScoreMetadataEditor.tsx`,
  `src/tsx/ScoreRevisionList.tsx`, `src/tsx/PublicProjectPage.tsx`,
  `src/tsx/MyScoresPage.tsx`, `src/CollectionContext.tsx`
- `firestore.rules`, `tests/rules/firestore.test.ts`
- `scripts/lib/scoreRevisions.ts`, `scripts/migrations/` (M3, M4)

## Acceptance

- Two concurrent uploads of a new revision both persist, as consecutive links.
- A re-upload with a corrected composer shows the new composer unless an override
  is set.
- Editors cannot set `metadataOverride`; nobody can update a `scoreRevisions` doc
  (rules tests).
- After M3/M4 every revision has `metadata` and a valid `prevRevisionId` chain.
- Exporter uploads still appear on the flag-off homepage.
