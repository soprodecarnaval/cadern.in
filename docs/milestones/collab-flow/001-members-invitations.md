# 001 — Members & invitations

**Goal:** Membership as `projects/{pid}/members/{uid}` documents and invitations at
`projects/{pid}/invitations/{uid}`, with the role restrictions enforced in rules.
Fixes the live bug that invitation acceptance is denied by the deployed rules, and
replaces the broken invite-by-email with invite-by-username.

**Depends on:** 000.

Spec: PLAN §2.1, §2.1.1, §2.1.2, §4.3 (`projects`, `members`, `invitations`),
§4.3.1, §4.5, §5.0.

## Decisions

- **Member docs carry `displayName` only** — they are publicly readable.
- **Invite by username = Firebase Auth `displayName`.** Lookup is a callable
  function `findUserForInvite({ projectId, displayName })` (first function in
  `functions/`), ADMIN+ only; returns found / not-found / ambiguous, never an
  email. No match shows "Usuário não encontrado".
- **Display names come from Firebase Auth.** Nothing writes `users/{uid}`, so
  member docs, invitations and the migrations all read Auth (fallback "Usuário
  sem nome").
- **`owner` is never granted** — not by owners, not by invitation. Exactly one per
  project; transfer is deferred (PLAN §8).
- **Owners cannot modify or delete their own member doc**, so a project always
  keeps an owner. Ownership transfer stays deferred (PLAN §8).
- **`roles.ts` takes a role, not a project doc.** Callers resolve the current
  user's role once (one member-doc read) and pass it around; capability predicates
  are pure functions of the role.

## Steps

1. ✅ Schemas in `types/docs.ts`: `zProjectMember`, new `zUserProjectInvitation*`
   (with `projectId`, `projectTitle`, `fromDisplayName`, `toDisplayName`);
   `deletedAt` on `zProjectData`; drop `members` from `zProjectCreateData`.
2. ✅ `db.ts`: `createProject` as the two-doc batch (§5.0); `getProjectMembers`,
   `getMemberRole`, `setProjectMember`, `removeProjectMember` (each paired with
   `memberIds` in a batch); invitations at the deterministic path;
   `getPendingUserProjectInvitations` as a `collectionGroup` query;
   `acceptUserProjectInvitation` writing invitation + own member doc + `memberIds`.
3. ✅ `firestore.indexes.json`: collection-group index on `invitations`
   (`toUserId`, `accepted`, `deletedAt`).
4. ✅ `functions/`: first real function, so also set up the codebase for the rest of
   the milestone (emulator wiring, tests, deploy). `findUserForInvite` callable;
   replace `getUserByEmail` in `ProjectSettingsPage`.
5. ✅ `roles.ts`: `isOwner/isAdmin/isEditor/isReviewer(role)` plus capability
   predicates (`canInvite`, `canGrantRole(actorRole, targetCurrentRole, newRole)`,
   `canRemoveMember`, `canEditProjectTitle`, …). Unit tests.
6. ✅ Rules: `projects` (incl. the invitee `memberIds` clause), `members`,
   `invitations`, the `invitations` collection-group rule; role helpers read the
   member doc. Keep the legacy `members`-map helpers working for flag-off reads
   until M9. Rules tests covering every row of §4.3.1.
7. ✅ `storage.rules`: `role()` reads the member doc (§4.5).
8. ✅ Migrations `202610081200` M1 (`deletedAt: null` on projects/songbooks),
   `202610081201` M1b (map → docs, `displayName` from Firebase Auth),
   `202610081202` M1c (deletes the legacy top-level invitations — not carried
   over, since pre-existing projects are deleted at the prod launch; no rules
   match them any more). Applied on staging ✓; ⏳ prod after deploy.
9. ✅ UI: `ProjectSettingsPage` lists members by `displayName`; role select limited by
   `canGrantRole`; owner-only removal; invitation log with names; pending
   invitations accept/deny for the invitee; `CreateProjectPage` and
   `getOrCreateDefaultProject` use the new `createProject`.
10. ⏳ Deploy order: rules + hosting + function → **immediately** M1/M1b/M1c →
    export-app release. The rules read member docs only, so role checks fail
    between the deploy and M1b (accepted: only the export app writes in prod).

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
