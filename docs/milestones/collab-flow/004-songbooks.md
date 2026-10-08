# 004 — Songbooks

**Goal:** Songbooks become persisted, versioned project products: admins curate
entries and covers, editors keep pins current, owners publish, and anyone can
generate the INSTRUMENT_SONGBOOKs of a published songbook. Published songbooks
define the homepage.

**Depends on:** 001, 002, 003.

Spec: PLAN §2.5–§2.7, §4.3 (`songbooks`, `songbookRevisions`), §4.4, §5.5–§5.7, §7.1.

## Decisions

- **Every change is a new `songbookRevisions` doc** + `currentRevisionId` bump, in
  one batch.
- **Editor revisions must build on the current revision** and leave
  `entries`/`covers` identical (PLAN §4.3).
- **`index` is frozen at revision creation**; `createSongBook` stops numbering.
- **Entries come from the project's own scores plus its linked scores** (006).
  If 006 has not landed, own scores only.
- **Homepage = scores pinned by published songbooks, at the published revision**
  (PLAN §4.4), read from the function-maintained `scores.published` marker
  (PLAN §2.2.1) — never by searching songbooks client-side.
- Large slice — split into sub-PRs along the steps below.

## Steps

1. Schemas: `zSongbookData` (container, `currentRevisionId`, `deletedAt`),
   `zSongbookRevision` (`entries` with `index`, `pins`, `covers`, `prevRevisionId`,
   `createdBy`, `note`). Remove `"latest"` from the score ref.
2. `db.ts`: create songbook (container + revision 1), `createSongbookRevision`
   (copy-on-write from current), `getSongbookBySlug`, `getProjectSongbooks`,
   `getSongbookRevisions`.
3. Persist the builder: `SongBookTable` state saves as a revision (admin); load an
   existing songbook into it; the score picker searches the project's own and
   linked scores.
4. Routes: `/projects/:slug/songbooks`, `/projects/:slug/songbooks/:songbookSlug`,
   public `/songbooks/:projectSlug/:songbookSlug`.
5. `createSongBook` / `PdfGenerator`: consume frozen `index`, pinned revisions and
   `revision.covers[instrument]`.
6. Stale-pin badge + "bump entry" / "bump all" (EDITOR+).
7. Deleted-score rendering (§5.7): `deleted` on `SectionScore`, struck-through index
   entry, omitted pages, front-matter marker, struck row in the web view.
8. Covers: bulk filename-matched upload via `parseInstrument`, warnings for
   unmatched files, `songbooks/{id}/{revisionId}/covers/` storage path, admin-only.
9. Publish/unpublish and soft delete (owner); public page for published songbooks
   showing the current revision only. Project page (`PublicProjectPage`): non-members
   see only published songbooks; members also see scores, links and unpublished
   songbooks (PLAN §4.4).
10. Revision history view (members only).
11. `syncPublishedScores` Cloud Function (PLAN §2.2.1): triggers on `songbooks`,
    `scores`, `projects` writes; recomputes `published` for affected scores.
    Emulator tests: publish, unpublish, re-pin, songbook/score/project soft delete,
    two songbooks pinning different revisions. Plus
    `scripts/rebuildPublishedScores.ts` for migrations and repair.
12. Homepage: `CollectionContext` (flag-on path) queries `scores where published !=
    null` and loads each published revision; results link to it. Score page
    defaults non-members to `published.revisionId`. Remove the CADERNIN uid filter
    and `VITE_CADERNIN_UID` from the flag-on path.
13. Rules: `songbooks`, `songbookRevisions` (incl. current-revision and
    identical-entries/covers checks), `storage.rules` `songbooks/**`; no client
    write may set `scores.published`. Tests, incl.
    "editor cannot roll back entries via an old `prevRevisionId`" and "non-member
    cannot read a non-current or unpublished revision".
14. Migration M5 for any existing `songbooks` docs, then `rebuildPublishedScores`.

## Files

- `types/docs.ts`, `types/viewModels.ts`, `src/lib/db.ts`, `src/lib/songbook.ts`, `src/lib/roles.ts`
- `src/createSongBook.ts`, `src/tsx/PdfGenerator.tsx`, `src/tsx/SongBook*.tsx`
- `src/tsx/App.tsx` + new songbook pages, `src/tsx/PublicProjectPage.tsx`, `src/CollectionContext.tsx`
- `firestore.indexes.json`
- `functions/src/syncPublishedScores.ts` (new), `scripts/rebuildPublishedScores.ts` (new)
- `firestore.rules`, `storage.rules`, `tests/rules/`
- `scripts/migrations/` (M5)

## Acceptance

- Reordering entries between two instrument exports cannot change any index number.
- An editor can bump pins and nothing else (UI and rules).
- A non-member reaches a published songbook's current revision and can generate
  its PDFs; nothing else.
- A non-member on a project page sees its published songbooks and no score list.
- A soft-deleted score keeps its number, struck through, with no pages emitted.
- With the flag on, the homepage lists exactly the scores pinned by published
  songbooks; unpublishing a songbook removes its scores within seconds (unless
  another published songbook pins them).
- Re-pinning a published songbook moves the score's `published.revisionId`; a
  non-member opening the score page sees that revision.
