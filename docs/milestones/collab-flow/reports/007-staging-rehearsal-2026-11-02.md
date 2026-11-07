# Staging rehearsal — 2026-11-02

Status: backup, migration and data verification complete. Merge/deployment and UI
smoke tests await the dataset migration PR and staging CI deployment permissions. Staging
client reads are enabled; client writes remain paused. Production data was not
changed.

## Backup

Staging matched production's 1,070 score IDs, titles, tags, project assignments and
latest revision pointers before the rehearsal. Its clone marker was complete and
its schema version was `202604271800`. No Cloud Functions were deployed on staging.
Client access was paused before backup and migration.

Private backup root:

```text
gs://cadernin-staging-backups/pre-collab-flow-20261102T183519Z
```

| Backup | Location | Verification |
|---|---|---|
| Firestore | `firestore/` | Managed export `SUCCESSFUL`; 2,162 documents |
| Storage | `storage/` | 15,025 objects, 1,534,584,299 bytes; source/backup size and CRC32C matched |
| Auth | `config/auth-cadernin-staging.json` | One account; valid Firebase Auth export |
| Rules/recovery metadata | `config/rules.json`, `config/backup.json` | Original rules saved before pausing client access |
| Verification | `config/verification.json` | Backup completion recorded before migration execution |

Local private records are in `secrets/staging-rollout-20261102T183519Z/`.
The original ruleset references are retained in `rules.json`; deployment can
replace the temporary maintenance rules, or the saved originals can be restored.
The temporary read-only rules preserve the original read restrictions and remove
client write grants.

## Migration

The read-only catalog report and bounded migration dry run passed. No legacy
invitations required deletion. The dry run reported 827 score corrections,
including 375 tag corrections, 587 predecessor links and four rejected duplicates.

Applied on `cadernin-staging`, Firestore `(default)`, using the staging key:

```sh
npx tsx --env-file=.env.staging scripts/migrations/migrate.ts --include-dataset --to=202610311301 --execute --forward-only
```

The execution wrapper supplied the required `SCRIPTS_*` settings from the staging
env's corresponding `SCRIPTS_*`/`VITE_*` values and verified the project/key match.
It also required the successful backup verification record before execution.

All ten pending migrations completed. The MSCZ backfill stamped 1,070 files with
zero missing files or failures. Final schema version: `202610311301`.

## Data verification

| Check | Result |
|---|---:|
| Score containers retained | 1,070 |
| Original titles preserved | 1,070 |
| Legacy revision documents retained | 1,070 |
| New revision documents | 1,070 |
| Corrected styles | 375 |
| Exact predecessor links | 587 |
| Soft-deleted duplicates, with revisions/files retained | 4 |
| Atomic score-correction journals | 827 |
| Live destination projects | 10 |
| Published songbooks | 19 |
| Distinct pinned scores / publication markers | 1,030 |
| Deferred scores retained and unpublished | 33 |
| Storage objects retained | 15,025 |
| Intentionally rewritten MSCZ objects | 1,070 |
| Other objects with unchanged content checksums | 13,955 |
| Objects with preserved Firebase download tokens | 15,007 |

Every pin references an existing exact latest revision. Original revision metadata
and titles remain intact. All 1,070 revision MSCZ paths are distinct; three sampled
files contain the correct embedded score/revision IDs. No reviewed score
corrections remain pending and the catalog reports no mapping errors.
All application Storage metadata matches the backup; only reserved backup
timestamp annotations are ignored. A public staging Firestore score read returned
HTTP 200 after restoring read access.

The original snapshot has 40 approved exclusions: 33 deferred scores, three scores
in archived Madeira Pirata, and four rejected Garota duplicates. After M6
soft-deleted the duplicates, M7's live-score baseline reported 36 omissions:
the 33 deferred scores plus the three retained Madeira scores.

## Deployment remaining

- Staging's `FIREBASE_SERVICE_ACCOUNT` GitHub environment secret is configured.
  The service account still lacks deployment permissions; Cloud Functions listing
  returned `cloudfunctions.locations.list` denied. Approval is pending to grant
  `roles/firebase.admin` and `roles/iam.serviceAccountUser` on staging.
- GitHub lookup during rehearsal found no PR with head `feat/collab-data-migration`.
  A PR is being prepared in the existing milestone stack, which ultimately merges
  to `main`, before deploying this branch's complete rollout.
- Deploy the approved code/rules/functions, then verify permissions, invitations,
  uploads, historical links, songbooks, PDFs and homepage behavior. Client writes
  remain paused until that deployment is ready.
- Production backup/migration/deployment and M9 are separate future steps.
