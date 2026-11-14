# B/004 → C/008

Status: implementation locally reviewed and validated; human acceptance pending.
Implementation commit: recorded in the next documentation commit after implementation.
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
migration. B/005 and B/006 stay open pending separate mockup/plan approvals.
