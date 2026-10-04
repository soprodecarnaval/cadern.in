# 003 — Soft deletes

**Goal:** Projects and scores are soft-deleted by their owner only, every read path
honours `deletedAt`, and nothing can be hard-deleted.

**Depends on:** 001, 002.

Spec: PLAN §6, §4.1, §4.3 (`alive(pid)`).

## Decisions

- **No restore UI** in v1 (PLAN §8); restore is a console/script operation.
- Songbook soft delete and the songbook-driven homepage land with 004; this slice
  only covers project/score deletes and the read paths that exist now.

## Steps

1. `db.ts`: `softDeleteProject`; `getAllProjects`, `getUserMemberProjects`,
   project score lists filter `deletedAt` (query where possible, application code
   otherwise). Remove any hard-delete call.
2. Project pages: hide scores of soft-deleted projects and soft-deleted scores.
3. UI: owner-only "excluir" for project (settings) and score (score page), with
   confirmation; gated by `canDeleteProject` / `canDeleteScore`.
4. Rules: `allow delete: if false` everywhere; `alive(pid)` in every role predicate;
   owner-only `deletedAt` on projects and scores. Tests, including "members of a
   deleted project lose all write access".

## Files

- `src/lib/db.ts`, `src/lib/roles.ts`
- `src/tsx/ProjectSettingsPage.tsx`, `src/tsx/ScorePage.tsx`,
  `src/tsx/MeusProjetosPage.tsx`, `src/tsx/PublicProjectPage.tsx`
- `firestore.rules`, `tests/rules/`

## Acceptance

- A soft-deleted score disappears from its project page; its URL still resolves.
- A soft-deleted project disappears from "meus projetos" and its members can no
  longer write anything under it.
- No rules path allows `delete` (tests).
