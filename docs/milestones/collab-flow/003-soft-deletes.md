# 003 — Soft deletes

**Goal:** Projects and scores are soft-deleted by their owner only, every read path
honours `deletedAt`, and nothing can be hard-deleted.

**Depends on:** 001, 002.

Spec: PLAN §6, §4.1, §4.3 (`alive(pid)`).

## Decisions

- **No restore UI** in v1 (PLAN §8); restore is a console/script operation. A
  deleted project freezes every write under it — the owner's included — so it
  can't be restored from the client either.
- **Deleting a project asks for its name**, since its scores disappear with it.
- **Deleting a project cancels its pending invitations** in the same batch, so they
  leave invitees' inboxes; accepting one into a deleted project is denied anyway.
- **Live-project filters run in code**, not as `where("deletedAt", "==", null)`,
  which would also drop documents created before the field existed. The rules'
  `alive()` uses `data.get('deletedAt', null)` for the same reason.
- Owner soft-delete of scores landed in 002; songbook soft delete lands with 004;
  the songbook-driven homepage is 004.

## Steps

1. ✅ `db.ts`: `softDeleteProject` (+ cancels pending invitations);
   `getAllProjects`, `getUserMemberProjects` return live projects only.
2. ✅ Read paths: `CollectionContext` skips scores of deleted projects;
   `PublicProjectPage`, `ProjectSettingsPage` and `ScorePage` treat a deleted
   project (or its scores) as not found.
3. ✅ UI: owner-only "Zona de perigo" → "Excluir projeto" (type the name) on the
   settings page; "Excluir partitura" on the score page. `canDeleteProject`,
   `canDeleteScore`, `canEditScoreMetadata` in `roles.ts`.
4. ✅ Rules: `alive(pid)` in every role predicate and in invitation acceptance;
   `allow delete: if false` on projects and scores. Tests: hard deletes denied,
   owner-only soft delete, a deleted project can't be restored or written to by
   any member, nor joined.

## Files

- `src/lib/db.ts`, `src/lib/roles.ts` (+ test), `src/CollectionContext.tsx`
- `src/tsx/ProjectSettingsPage.tsx`, `src/tsx/ScorePage.tsx`,
  `src/tsx/PublicProjectPage.tsx`
- `firestore.rules`, `tests/rules/firestore.test.ts`

## Acceptance

- A soft-deleted score disappears from its project page and the homepage.
- A soft-deleted project disappears from "meus projetos" and the homepage, and its
  members can no longer write anything under it.
- No rules path allows hard-deleting a project or score (tests).
