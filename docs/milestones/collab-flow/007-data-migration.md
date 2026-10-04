# 007 — Data migration & launch

**Goal:** The real collection organised into its four projects and their yearly
songbooks, the flag turned on in prod, and legacy data removed.

**Depends on:** 000–006.

Spec: PLAN §7, §7.1.

## Steps

1. M6: identify carnaval, garota, na tora, besourinhos; create or reconcile their
   project docs and member docs, all owned by the CADERNIN uid; move scores into
   them (`projectId`).
2. M7: songbooks per project-year — carnaval via `generateCarnivalSections`, others
   via `generateSectionsByStyle` (`src/utils/songBookRows.ts`); published; manual
   reordering afterwards in the UI.
3. Staging dry run of the whole sequence on a prod snapshot. Homepage report: every
   score on today's homepage that no published songbook pins — those drop off at
   launch (PLAN §7.1). Review the list and place or accept each.
4. Turn `FEATURE_FLAG_COLLAB_FLOW` on in prod.
5. Remove flag-off code paths, dual-writes in `uploadScore`, and the legacy rules
   (`members` map helpers, `revisions` match + collection-group rule, top-level
   `invitations`). Release an export-app build without dual-writes.
6. M9: drop legacy data — score-level metadata fields, `projects.members`,
   top-level `invitations`, `scores/*/revisions`.
7. (nice-to-have) PDF index-page → songbook reconstruction script.

## Files

- `scripts/migrations/` (M6, M7, M9), optional `scripts/rebuildSongbooksFromPdf.ts`
- `firestore.rules`, `storage.rules`, `src/` legacy paths
- `.env.production` / GitHub variable

## Acceptance

- Each of the four projects lists its scores; each has one published songbook per
  year whose PDFs match what the band uses.
- After M6/M7, the homepage lists the published songbooks' scores, and every score
  that dropped off was on the reviewed report.
- After M9, no code, rule or document references the legacy shapes.
