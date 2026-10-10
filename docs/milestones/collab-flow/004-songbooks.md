# 004 — Songbooks

**Goal:** Songbooks become persisted, versioned project products: admins curate
entries and covers, editors keep pins current, owners publish, and anyone can
generate the INSTRUMENT_SONGBOOKs of a published songbook. Published songbooks
define the homepage.

**Depends on:** 001, 002, 003.

Spec: PLAN §2.1.3, §2.5–§2.7, §4.3 (`songbooks`, `songbookRevisions`,
`scoreLinks`), §4.4, §5.5–§5.7, §7.1.

## Decisions

- **Four stacked PRs:** 004a model + editor + save; 004b PDFs from a revision +
  covers; 004c pins + publishing + public pages; 004d published marker + homepage.
- **Every change is a new `songbookRevisions` doc** + `currentRevisionId` bump, in
  one transaction that must build on the current revision.
- **Editor revisions must build on the current revision** and leave
  `entries`/`covers` identical (PLAN §4.3).
- **`index` is frozen at revision creation**; `createSongBook` no longer numbers
  anything — unsaved lists are numbered before they reach it (004b).
- **Songbook id is `${projectId}~${slug}`**, so a slug is unique per project; the
  slug is fixed at creation, only the title can be renamed.
- **Entries come from the project's own scores plus its linked scores.** The link
  model (`projects/{id}/scoreLinks/{scoreId}`) lands here, not in 006: saving the
  homepage builder links any scores of other projects in the same batch.
- **The homepage builder stays** for everyone, and gets "Salvar caderninho" (flag
  on). Logged-out users log in first; the builder's list survives that — and
  reloads — in `localStorage`, for everyone.
- **PDF options stay a generation-time choice** for now (PLAN §8).
- **No M5:** there are no songbook docs to migrate.
- **Homepage = scores pinned by published songbooks, at the published revision**
  (PLAN §4.4), read from the function-maintained `scores.published` marker
  (PLAN §2.2.1) — never by searching songbooks client-side (004d).

## 004a — model, editor, save

1. ✅ Schemas: songbook container (`currentRevisionId`, `deletedAt`), songbook
   revision (`entries` with `index`, `pins`, `covers`, chain fields), score link.
   The old `"latest"` pin is gone.
2. ✅ `db.ts`: `createSongbook` (container + revision 1 + links, one batch),
   `createSongbookRevision` (transaction on the current revision), getters,
   `getProjectScoreLinks`.
3. ✅ Converters `toSongbookRevisionContent` / `fromSongbookRevision` (+ tests);
   `loadPinnedScores`; view-model factory shared with the homepage.
4. ✅ Pages: `/projects/:slug/songbooks` (list; admins create) and
   `/projects/:slug/songbooks/:songbookSlug` (contents, PDF generation; admins
   edit with the builder table and a project/linked score picker; members see the
   history and older revisions via `?versao=`).
5. ✅ Homepage: `localStorage` persistence; "Salvar caderninho" → project + title
   → songbook revision 1; login continues into the save.
6. ✅ Rules + tests: songbook create (admin, id = project~slug, unpublished, first
   revision alongside); updates (editor pointer with a new revision, admin title,
   owner publish/delete); revisions immutable, extending the current one, editors
   only re-pin; non-members read only a published songbook's current revision and
   may only list published ones; score links (editor+, other projects only, real
   source).

## 004b — PDFs from a revision

1. ✅ One numbering path: every list handed to PDF generation is numbered
   (`NumberedSongbookItemViewModel`). A saved revision carries its frozen
   `index`; the homepage builder numbers its list by position with
   `numberSongbookItems` — the same function that freezes numbers on save.
   `createSongBook` just prints `index`.
2. ✅ Deleted scores (§5.7): struck-through index entry keeping its number, no
   pages, "Partituras riscadas foram removidas do acervo." under the index; same in
   the web view; they don't count in the per-instrument totals.
3. ✅ Covers: "Capas" on the songbook page (admins) matches PNG/JPEG files to
   instruments by name (`matchCoverFiles`, + tests), uploads them to
   `songbooks/{id}/{revisionId}/covers/` and creates a revision noted
   "capas: …"; saved songbooks' PDFs use them instead of the per-generation
   pickers. `storage.rules`: covers writable by the project's admins; a deleted
   project grants no storage writes at all.
4. ✅ PDF assets (fonts, carnival covers, anti-harassment pages) load from absolute
   paths — they 404'd on any route but `/`.

## 004c — pins, publishing, public pages

1. Stale-pin badge + "atualizar" for one entry or all (EDITOR+).
2. Publish / unpublish / soft delete (owner).
3. Public page `/songbooks/:projectSlug/:songbookSlug` for published songbooks.
4. Project page shows non-members only published songbooks (PLAN §4.4).

## 004d — published marker + homepage

1. `syncPublishedScores` Cloud Function (PLAN §2.2.1) + emulator tests, and
   `scripts/rebuildPublishedScores.ts`.
2. Homepage (flag on): `scores where published != null` + published revisions;
   score page defaults non-members to `published.revisionId`; CADERNIN filter
   removed from the flag-on path.

## Acceptance

- Reordering entries between two instrument exports cannot change any index number.
- An editor can bump pins and nothing else (UI and rules).
- A non-member reaches a published songbook's current revision and can generate
  its PDFs; nothing else.
- A soft-deleted score keeps its number, struck through, with no pages emitted.
- A logged-out user builds a list, logs in to save it, and lands on the new
  songbook with the same list.
- With the flag on, the homepage lists exactly the scores pinned by published
  songbooks.
