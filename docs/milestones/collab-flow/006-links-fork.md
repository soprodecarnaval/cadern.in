# 006 — Score links & fork-on-upload

**Goal:** A project uses other projects' scores by linking them from the website,
and an editor who uploads a new revision of a linked score from the export app gets
a fork under their own project — after confirming it.

**Depends on:** 001, 002.

Spec: PLAN §2.1.3, §2.2 (`forkedFrom`), §2.3 (`origin`), §4.3 (`scoreLinks`, fork
clause on `scores`), §5.3.

## Decisions

- **No fork button on the website.** Forking only happens on upload, in the export
  app.
- **Links are by score, not revision.** Songbooks pin revisions; links only make a
  score available to a project.
- **The uploaded files are the fork's revision 1.** Nothing is shared with the
  source, so no cross-score storage dependency.
- **Fork is user-confirmed.** The export app explains that the score belongs to
  another project and that a new score will be created under theirs, replacing the
  link; "criar como partitura nova" is the alternative.
- **Songbooks are not rewritten on fork.** A badge on entries that pin the source
  lets an ADMIN swap to the fork, keeping `order` and `index`.

## Steps

### Web — links

1. Schema `zScoreLink`; `db.ts` `linkScore`, `unlinkScore` (soft), `getProjectLinks`.
2. "Adicionar ao projeto" on the score page and search results: picker of EDITOR+
   projects other than the score's own.
3. Project page lists linked scores alongside own scores, marked as linked with the
   source project; "remover" unlinks.
4. Rules: `scoreLinks` (EDITOR+ of target, source must be another project). Tests.

### Export app — fork on upload

5. In `UploadPanel`, resolve the target: own score with the derived id → revision;
   linked score whose resolved title slugifies to the same slug → fork; else new
   score (PLAN §5.3 table).
6. Fork confirmation dialog (pt-BR) naming the source score and project, with
   "criar derivação" / "criar como partitura nova" / cancel.
7. `uploadScore` fork mode: container with `forkedFrom` (source's
   `latestRevisionId`), revision 1 with `origin: {type:"fork", …}`, link
   soft-deleted in the final batch.
8. Rules: `scores` create clause requiring a live link for `forkedFrom`. Tests:
   fork without a link → denied; fork into a project where the user is reviewer →
   denied.

### Web — lineage and songbooks

9. Lineage on the score page: "derivado de X (projeto Y) @ revisão N" linking back;
   optional list of forks on the source (`scores where forkedFrom.scoreId == id`).
10. Songbook badge "derivação disponível neste projeto" + admin "trocar pela
    derivação" (new songbook revision, same `order`/`index`). Lands after 004.

## Files

- `types/docs.ts`, `src/lib/db.ts`, `src/lib/roles.ts`, `src/lib/uploadScore.ts`
- `src/tsx/ScorePage.tsx`, `src/tsx/ScoreSearchResultRow.tsx`,
  `src/tsx/PublicProjectPage.tsx`, new project picker
- `src/export-app/components/UploadPanel.tsx`, new fork confirmation
- songbook view components (step 10)
- `firestore.rules`, `tests/rules/`

## Acceptance

- An editor links a score from another project; it shows in their project and can
  go into a songbook.
- Uploading that score from the export app into the linking project asks for
  confirmation, then creates a new score in that project with lineage back to the
  source; the link is gone; the source is untouched.
- The source project's scores cannot be revised by the linking project's editors
  (rules test).
- An admin swaps a songbook entry from the source to the fork without changing its
  number.
