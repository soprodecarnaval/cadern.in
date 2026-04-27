# Tech Debt

## Project ownership transfer
Project ownership is fixed at creation time. There is no UI to transfer the owner role to another member.

## Project invitation role
Invited users join with the role specified in the invitation. Inviter cannot currently specify role in the invite email flow. Future: let inviter pre-specify role in a richer invite UI.

## Score count on Meus Projetos
`MeusProjetosPage` fetches all score docs per project just to get a count. At scale (many projects × many scores), this is expensive. Upgrade path: use Firestore `getCountFromServer()` — 1 read per project regardless of score count.

## Unit and integration tests for db.ts and Firestore rules
No automated tests exist for `db.ts` or `firestore.rules`. Recommended setup: Vitest + Firebase Emulator Suite (`@firebase/rules-unit-testing`). Pure logic (slug generation, role hierarchy) can be tested without Firebase.

## Storybook
No component sandbox exists. Add Storybook to develop and review UI components in isolation, especially role badges, invitation cards, and project settings sections.

## Remove Minhas Partituras view
`MyScoresPage` and its nav link are unnecessary — score upload and browsing will be driven through projects. Remove the page, its route, and the nav entry; make `MeusProjetosPage` the primary entry point for score management.

## Modularize ProjectSettingsPage
`ProjectSettingsPage.tsx` contains four distinct sections (title editor, members table, invite form, invitations log) as inline markup. Extract each into its own component under `src/tsx/ProjectSettingsPage/`.

## User displayName collision
Create displayName index and don't allow users to set their displayName to some existing one. We'll need to route displayName editing through a cloud function.

## Storage monitoring
Implement mechanisms for admins to monitor storage usage and set per-user upload limits.

## Purge script for soft-deleted songs
Create a script that permanently deletes soft-deleted songs (Firestore docs + Storage files) after a retention period.

## Refresh CollectionContext after upload
Currently `CollectionContext` loads data once on mount. After a user uploads a new score, the collection is stale until page reload.

## Storage download URL regeneration on read
Download URLs (with Firebase Storage tokens) are persisted in Firestore revision docs. If a token is ever revoked, stored URLs silently break. Mitigation: on a 404, fall back to `getDownloadURL` from the client SDK using the stored storage path, then write the fresh URL back to Firestore.

## Multi-instrument parts
`Part.instrument` is currently a single `Instrument` value. In theory a part (e.g. a doubling part) could cover more than one instrument. The type should be changed to `instrument: Instrument | Instrument[]` and the instrument detection in `parseUploadedFiles` updated accordingly.
