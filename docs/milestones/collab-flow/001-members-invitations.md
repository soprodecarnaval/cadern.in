# 001 — Members & invitations

**Goal:** Membership as `projects/{pid}/members/{uid}` documents and invitations at
`projects/{pid}/invitations/{uid}`, with the role restrictions enforced in rules.
Fixes the two live bugs: invitation acceptance and invite-by-email are both denied
by the deployed rules.

**Depends on:** 000.

Spec: PLAN §2.1, §2.1.1, §2.1.2, §4.3 (`projects`, `members`, `invitations`),
§4.3.1, §4.5, §5.0.

## Decisions

- **Member docs carry `displayName` only** — they are publicly readable.
- **Invite lookup is a callable function** `findUserForInvite({ projectId, email })`
  (first function in `functions/`). Returns `{ uid, displayName }` to ADMIN+ only.
- **Owners cannot modify or delete their own member doc**, so a project always
  keeps an owner. Ownership transfer stays deferred (PLAN §8).
- **`roles.ts` takes a role, not a project doc.** Callers resolve the current
  user's role once (one member-doc read) and pass it around; capability predicates
  are pure functions of the role.

## Steps

1. Schemas in `types/docs.ts`: `zProjectMember`, new `zUserProjectInvitation*`
   (with `projectId`, `projectTitle`, `fromDisplayName`, `toDisplayName`);
   `deletedAt` on `zProjectData`; drop `members` from `zProjectCreateData`.
2. `db.ts`: `createProject` as the two-doc batch (§5.0); `getProjectMembers`,
   `getMemberRole`, `setProjectMember`, `removeProjectMember` (each paired with
   `memberIds` in a batch); invitations at the deterministic path;
   `getPendingUserProjectInvitations` as a `collectionGroup` query;
   `acceptUserProjectInvitation` writing invitation + own member doc + `memberIds`.
3. `firestore.indexes.json`: collection-group index on `invitations`
   (`toUserId`, `accepted`, `deletedAt`).
4. `functions/`: first real function, so also set up the codebase for the rest of
   the milestone (emulator wiring, tests, deploy). `findUserForInvite` callable;
   replace `getUserByEmail` in `ProjectSettingsPage`.
5. `roles.ts`: `isOwner/isAdmin/isEditor/isReviewer(role)` plus capability
   predicates (`canInvite`, `canGrantRole(actorRole, targetCurrentRole, newRole)`,
   `canRemoveMember`, `canEditProjectTitle`, …). Unit tests.
6. Rules: `projects` (incl. the invitee `memberIds` clause), `members`,
   `invitations`, the `invitations` collection-group rule; role helpers read the
   member doc. Keep the legacy `members`-map helpers working for flag-off reads
   until M9. Rules tests covering every row of §4.3.1.
7. `storage.rules`: `role()` reads the member doc (§4.5).
8. Migrations M1 (`deletedAt: null` on projects/songbooks), M1b (map → docs,
   `displayName` from `users/{uid}`), M1c (top-level invitations → per-project).
9. UI: `ProjectSettingsPage` lists members by `displayName`; role select limited by
   `canGrantRole`; owner-only removal; invitation log with names; pending
   invitations accept/deny for the invitee; `CreateProjectPage` and
   `getOrCreateDefaultProject` use the new `createProject`.
10. Deploy order: rules (old + new shapes accepted) → migrations → app.

## Files

- `types/docs.ts`, `src/lib/db.ts`, `src/lib/roles.ts` (+ test), `src/lib/uploadScore.ts`
- `functions/src/index.ts`
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `tests/rules/`
- `scripts/migrations/` (M1, M1b, M1c)
- `src/tsx/ProjectSettingsPage.tsx`, `src/tsx/CreateProjectPage.tsx`,
  `src/tsx/MeusProjetosPage.tsx`, wherever invitations are shown

## Acceptance

- An admin invites by email, the invitee accepts, and is a member at the invited
  role — on the emulator *and* on staging with deployed rules.
- Admin cannot grant `admin`/`owner`, touch an admin/owner, or remove anyone;
  owner cannot demote or remove themselves — each a rules test.
- Member lists show names, never uids or emails.
- After M1b, every project's member docs match its old `members` map.
