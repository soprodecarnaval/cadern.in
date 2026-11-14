# B/004 → C/008

Status: implementation reviewed, validated and accepted by the user (`accept and move on`).
C/008 may integrate the implementation commit below.
Implementation commit: `29e33093ba2ed9fed874cbd3704c25965bf1bc6b`.
PR: https://github.com/soprodecarnaval/cadern.in/pull/433 (open for review).
Branch: `workstream/b-songbook-ui`. PR base: `main` (explicit chat override;
repository has no `staging` branch).

## Contract

- `/projects/:slug` owns the songbook list and empty-songbook creation flow.
- `/projects/:slug/songbooks` is a replacement redirect to `/projects/:slug`.
- Existing member `/projects/:slug/songbooks/:songbookSlug` and public
  `/songbooks/:slug/:songbookSlug` paths unchanged. Canonical/member split belongs to C/008.
- Member links use `songbookPath`; non-member links use `publicSongbookPath`.
- Owner/admin creation uses existing `getSongbook` + `createSongbook` services,
  empty entries/pins/covers, and then opens the existing member songbook route.
- `SongbookPageView.tsx` changes only two destinations: project back link and
  post-delete navigation now target `/projects/:slug` directly.
- No schema, rules or persistence API changes. No new dependency.

## Files / conflict boundary

- `PublicProjectPage.tsx`: supplies authenticated user; remounts view on project,
  role or user changes to discard prior UI state.
- `PublicProjectPageView.tsx`: consolidated list/creation, loading/error/retry states.
- `CreateSongbookForm.tsx`: extracted creation workflow with explicit cancel.
- `ProjectSongbooksPage.tsx`: redirect adapter; App route registration unchanged.
- Removed `ProjectSongbooksPageView.tsx` and standalone stories.
- `PublicProjectPage.stories.tsx`: role/query/link checks, creation, cancellation,
  duplicate/invalid titles, failures, pending state and list redirect.
- `SongbookPageView.tsx`: only the two navigation edits above. Integrate 004 before
  C's broader view edits. Future B/005 and B/006 also touch songbook views;
  coordinate their commits before concurrent edits.

## Validation

20 focused Storybook stories; additional browser back/delete and 390px layout
checks; Storybook TypeScript; targeted ESLint; demo-config app build; diff check.
Browser services mocked: no backend integration or production/staging writes.

## Coordination

Use this document for commit hashes, PR references and integration notes.
C should integrate the exact implementation commit recorded here, then own route
migration. B/005 implementation is approved and in progress; B/006 stays open pending its mockup/plan approval.

## B/005 ready for human review

Approved plan/mockup; branch `workstream/b-songbook-ui-005`, stacked on 004.
Touches songbook detail rows and the reader project-context prop in
`SongbookPageView.tsx`, reader rows, and selected editor cards. Routes and data
permissions unchanged. C: reconcile these small view changes when integrating;
Validation: 37 browser stories, 24 unit tests, six layout checks, TypeScript,
targeted ESLint and demo build passed. No new reads or dependencies.
005 implementation commit: `2483e1af019bd0f5b8292c277c39d19e2c346cfb`.
PR: https://github.com/soprodecarnaval/cadern.in/pull/436, stacked on #433
with `main` base per chat override. Human acceptance pending. 006 remains open.
