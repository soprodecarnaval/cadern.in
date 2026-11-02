# 007 — Data migration & launch

**Goal:** The real collection organised into band projects and their songbooks,
the flag turned on in prod, and legacy data removed.

**Depends on:** 000–006.

Spec: PLAN §7, §7.1.

## Pre-launch tooling (in progress)

- Deploy workflows authenticate with environment-specific service-account keys,
  then build → migrate schema forward → deploy. Pending dataset migrations block
  the entire migration path before any hooks or checkpoints; migration failures
  stop deployment.
- Registry audit: M1c (`202610081202`), M6 and M7 are dataset migrations; the other
  eleven remain schema migrations. Dataset execution requires a bounded
  `--include-dataset --to <id>` opt-in, including rollback and cleanup.
- Local production → staging clone script; dry run by default. Copies Firestore
  and Storage, maps CADERNIN to the existing staging account, retains staging Auth.
- Setup and operational limits: [CI-DATA.md](CI-DATA.md).
- Validate this tooling before M6/M7 and production rollout. No rollout is implied
  by adding the workflows.

## Steps

1. M6: reconcile carnaval-bh, garota, na-tora, besourinhos and the other independent
   groups; create project/member docs, owned by CADERNIN until future transfers;
   journal original score assignments, move scores, soft-delete emptied sources.
2. M7: songbooks per project-year — carnaval-bh via `generateCarnivalSections`, others
   via `generateSectionsByStyle` (`src/utils/songBookRows.ts`); published; manual
   reordering afterwards in the UI.
3. Staging dry run of the whole sequence on a prod snapshot. Homepage report: every
   score on today's homepage that no published songbook pins — those drop off at
   launch (PLAN §7.1). Review the list and place or accept each.
4. Turn `FEATURE_FLAG_COLLAB_FLOW` on in prod.
5. Remove flag-off code paths, dual-writes in `uploadScore`, and the legacy rules
   (`members` map helpers, `revisions` match + collection-group rule). Release an
   export-app build without dual-writes.
6. M9: drop legacy data — score-level metadata fields, `projects.members`,
   `scores/*/revisions`.
7. (nice-to-have) PDF index-page → songbook reconstruction script.

## M6/M7 implementation (in progress)

Registered dataset migrations: `202610311300` (M6) and `202610311301` (M7).
CI refuses to execute them or skip past them. Incorporate the reviewed score-report
decisions, review the mapping report and prepare backups before explicitly opting
in to their staging rehearsal. Production launch and M9 are separate work.

Explicit mapping in `scripts/lib/collabMapping.ts`:

| Source project | Destination songbook |
|---|---|
| besourinhos-2024 | besourinhos/2024 |
| blocae | blocae/acervo |
| carnaval-bh-2020 | carnaval-bh/2020 |
| carnaval-bh-2023 | carnaval-bh/2023 |
| carnaval-bh-2024 | carnaval-bh/2024 |
| carnaval-bh-2025 | carnaval-bh/2025 |
| carnaval-bh-2026 | carnaval-bh/2026 |
| crack-carnaval-bh-2026 | carnaval-bh/crack-2026 |
| festa-junina-2024 | carnaval-bh/festa-junina-2024 |
| garota-2024 | garota/2024 |
| garota-2025 | garota/2025 |
| garota-2026 | garota/2026 |
| madeira-pirata | Archived; no songbook |
| mama-vaquinha-2024 | mama-vaquinha/2024 |
| miscellaneous | miscellaneous/acervo |
| na-tora-2025 | na-tora/2025 |
| na-tora-2026 | na-tora/2026 |
| queimando-2024 | queimando/2024 |
| sopra-que-sara | sopra-que-sara/acervo |
| zagateile | zagateile/acervo |

M6 saves original project-to-score assignments under
`_meta/collabFlow/projects/{sourceProjectId}` **before** moving scores. A retry uses
that journal even after source projects are archived. Unknown projects, scores
without an assignment and ownership conflicts block execution. CADERNIN remains
the sole owner; member roles are merged without demoting existing members.

For moved scores, only the container's `projectId` changes. IDs, revision history, embedded file
identities, Storage paths and download URLs remain intact. Deleted scores also
move, retaining their deletion markers. Previously deleted source projects and
their scores are left alone. Once a source has no scores, M6 sets its `deletedAt`
and cancels pending invitations; member docs remain. Archived source projects stay
at their original top-level paths, without a parent project. Yearless groups keep
their existing live projects for later ownership transfer, except `madeira-pirata`:
that project is soft-deleted with its three scores and files retained at their
original paths, and no songbook is created.

M7 creates each container, revision 1 and provenance journal atomically. Pins use
exact latest revision IDs; numbering is fixed in the revision. Titles/references
use `project/songbook`; internal IDs keep `project~songbook`. Existing journaled
songbooks are preserved, including subsequent manual edits; unrelated songbook
collisions fail. `carnaval-bh/festa-junina-2024` retains general style grouping,
including its custom/blank legacy tags; moving it to Carnaval BH does not apply
the carnival-only section filter. Publication markers are rebuilt directly after M7 because initial
creation happens before CI deploys the triggers.

The read-only report simulates both steps without needing M6 applied:

```sh
npx tsx --env-file=.env.local scripts/planCollabMigration.ts
```

For production, if `.env.production` has only `VITE_FIREBASE_PROJECT_ID`, supply
the scripts project explicitly (the migration tooling requires it):

```sh
SCRIPTS_FIREBASE_PROJECT_ID=cadernin-6c0d1 npx tsx --env-file=.env.production scripts/planCollabMigration.ts
```

It reports every source/destination, exclusions and scores currently on the legacy
homepage that no proposed published songbook covers. M7 refuses unreviewed
omissions. The approved exceptions are the retired Madeira Pirata scores and the
exact 193 IDs in `scripts/data/collabDeferredStyles.json`; new unmatched scores,
conflicts and missing revisions still block execution. Other explicit exceptions
require a score ID and rationale in `APPROVED_HOMEPAGE_OMISSIONS` in
`scripts/lib/collabSongbooks.ts`.

For carnival grouping, missing/unrecognized styles are inferred from other live
scores with the same normalized title (case, accents, whitespace and punctuation
ignored). Evidence must agree on one recognized style; no fuzzy or majority-vote
guess is made. Grouping uses the inferred style without modifying score or revision
metadata. Evidence is saved in `_meta/collabFlow/styleInferences/{scoreId}`.
Deferred style reviews are saved in `_meta/collabFlow/deferredStyles/{scoreId}`.
Those scores remain live in their destination projects but are not initially
pinned by the migrated songbooks. Addressing them later requires reviewed
songbook revisions; rerunning M7 preserves existing books.

After reviewing that report, a staging dry run of registered migrations is:

```sh
npx tsx --env-file=.env.local scripts/migrate.ts --to 202610311301
```

Applying requires `--include-dataset --to=202610311301 --execute --forward-only`.
Stop writers/triggers during rehearsal
as described in [CI-DATA.md](CI-DATA.md). M6/M7 deliberately refuse automatic
rollback: restoring a pre-migration backup avoids discarding later edits. Keep
the assignment journals until rollout is verified.

Validation: `npx vitest run`, `npm run build`, `npm run test:migrations`.
The migration tests use only the `demo-cadernin` Firestore emulator and cover
read-only dry runs, partial moves/retries, preserved files/versions/edits, ownership
conflicts, omissions and frozen version pins/numbering.

Read-only production report on 2026-10-31: 20 source projects, 1,070 scores,
10 destination projects and 19 proposed songbooks. Style evidence resolves 162
previously unmatched scores. The 193 unresolved styles are explicitly deferred;
the three Madeira Pirata scores are excluded with their retired project. No
M6/M7 migration has been applied to cloud data.

## Files

- [Persisted score review](reports/007-score-review/README.md): interactive HTML,
  Markdown, CSVs, source snapshot, review decisions and offline generator.
  Report decisions are not yet applied to M6/M7 or cloud data. The report's
  **Review required** filter exposes unresolved score rows and lists unmatched
  index entries separately.

- `scripts/migrations/` (M6, M7, M9), optional `scripts/rebuildSongbooksFromPdf.ts`
- `firestore.rules`, `storage.rules`, `src/` legacy paths
- `.env.production` / GitHub variable

## Acceptance

- Each band project lists its scores and published songbooks per year (or
  `project/acervo` for yearless groups); PDFs match what the band uses.
- After M6/M7, the homepage lists the published songbooks' scores, and every score
  that dropped off was on the reviewed report.
- After M9, no code, rule or document references the legacy shapes.
