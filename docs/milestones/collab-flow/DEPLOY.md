# Collab flow — production deploy runbook

Steps to take production through each merged slice. Staging goes first with the
same steps (`.env.local` points at `cadernin-staging`); production repeats them with
the prod key. Run everything from the repo root, in fish.

**CI update:** deploy workflows apply schema migrations **before** Firebase
deployment, using environment-specific service-account keys. Pending dataset
migrations block the whole path before any migration executes; apply them with
a reviewed, bounded `--include-dataset --to <id> --execute` run first. The per-slice
merge-then-migrate instructions below describe the earlier manual rollout; do not
repeat them after CI has migrated. Backups, dry-run review, exporter releases and
verification remain operator steps. See [CI-DATA.md](CI-DATA.md) for credential
setup, sequencing and the local production → staging clone script.

Prod: project `cadernin-6c0d1`, bucket `cadernin-6c0d1.firebasestorage.app`,
Firestore `(default)` in `southamerica-east1`. Prod schema version before this
milestone: `202604271800`.

## 0. Backup (before any migration)

```fish
gcloud auth login
gcloud config set project cadernin-6c0d1
gcloud storage buckets create gs://cadernin-6c0d1-backups --location=southamerica-east1 --uniform-bucket-level-access  # once
gcloud firestore export gs://cadernin-6c0d1-backups/firestore/pre-collab-flow-YYYYMMDD --database='(default)'
gcloud storage rsync --recursive gs://cadernin-6c0d1.firebasestorage.app gs://cadernin-6c0d1-backups/storage/pre-collab-flow-YYYYMMDD
npx firebase auth:export secrets/auth-cadernin-6c0d1-YYYYMMDD.json --project cadernin-6c0d1
```

Check it finished: `gcloud firestore operations list --filter="metadata.outputUriPrefix:pre-collab-flow-YYYYMMDD"`
shows `SUCCESSFUL`, and `gcloud storage du --summarize` matches between source and backup.

**Restore** (only if a migration goes wrong and its `down` is not enough):

```fish
gcloud firestore import gs://cadernin-6c0d1-backups/firestore/pre-collab-flow-YYYYMMDD --database='(default)'
gcloud storage rsync --recursive gs://cadernin-6c0d1-backups/storage/pre-collab-flow-YYYYMMDD gs://cadernin-6c0d1.firebasestorage.app
```

An import overwrites documents with the same path and leaves newer ones in place.

## 1. Migration environment

Migrations run with `npm run migrate` (dry run) and `npm run migrate:up`
(schema execution). Dry runs preview both kinds; dataset execution additionally
requires `--include-dataset --to <id>`. See [CI-DATA.md](CI-DATA.md) for the registry
audit. For prod, use a separate env file so `.env.local` stays on staging:

```fish
cp .env.local .env.prod-scripts.local   # gitignored by *.local
# edit .env.prod-scripts.local:
#   SCRIPTS_FIREBASE_PROJECT_ID=cadernin-6c0d1
#   SCRIPTS_FIREBASE_STORAGE_BUCKET=cadernin-6c0d1.firebasestorage.app
#   SCRIPTS_CADERNIN_UID=<prod CADERNIN uid, from .env.production>
#   GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.cadernin-prod.json
npx tsx --env-file=.env.prod-scripts.local scripts/migrations/migrate.ts             # dry run
npx tsx --env-file=.env.prod-scripts.local scripts/migrations/migrate.ts --execute   # schema only; pending datasets block
```

The scripts print `Firebase project: …` first and abort if the key or bucket
belongs to another project. **Always dry-run first and read the output.**

## 2. Task 000 — foundations (PR #386)

1. Merge → the deploy workflow ships hosting + rules. The flag stays off in prod
   (`FEATURE_FLAG_COLLAB_FLOW` unset).
2. Migrate to `202610041500`:
   - `202609201500` part_names — rewrites `parts[].name` on every revision
     (display-only). Read the dry-run renames.
   - `202610041500` M2b — copies `scores/*/revisions` → `scores/*/scoreRevisions`.
     Legacy subcollection untouched.
3. Release the export app (dual-writes both subcollections).
4. Verify: homepage lists the same scores; an export-app upload shows on the
   homepage and lands in both subcollections.

## 3. Task 001 — members and invitations (PR #387)

**Before merging:** run the read-only project audit against prod and settle M1b
— see "Open" below:

```fish
npx tsx --env-file=.env.prod-scripts.local scripts/maintenance/auditProjects.ts
```

It lists each project's owners and members (legacy map and member docs) and its
live/deleted scores, and flags projects not solely owned by CADERNIN and scores
with no project doc.

**Cloud Functions prerequisite (first function, once per Firebase project):** the
project must be on the Blaze plan with these APIs enabled, or the deploy fails:

```fish
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com eventarc.googleapis.com --project cadernin-6c0d1
```

1. Merge → deploy ships hosting, rules and the `findUserForInvite` function.
2. **Immediately** migrate to `202610081202`. Until M1b runs, the rules find no
   member docs and deny role-gated writes (export-app uploads):
   - `202610081200` M1 — `deletedAt: null` on projects and songbooks.
   - `202610081201` M1b — project member docs.
   - `202610081202` M1c — deletes legacy top-level invitations.
   M1c is a dataset migration: review its invitation deletion and apply with
   `--include-dataset --to=202610081202 --execute --forward-only`.
3. Release the export app (reads roles from member docs).
4. Verify: an export-app upload by a project editor succeeds; homepage unchanged.

## 4. Task 002 — score revision model

1. Merge → deploy ships hosting and rules.
2. **Immediately** migrate to `202610081301` (dry run first):
   - `202610081300` M3 — chains existing revisions (`prevRevisionId` by
     `revisionNumber`), adds `slug` and `origin: upload`. The dry run warns about
     scores whose `latestRevisionId` isn't their highest revision.
   - `202610081301` M4 — copies each score's current metadata to
     `cachedMetadata` and to every revision's `metadata`; `published: null`.
3. Release the export app. From this deploy on, only builds with
   `commitScoreRevision` can upload: the rules require every new revision to
   extend the chain.
4. Verify: homepage unchanged; an export-app re-upload shows revision N+1 with
   refreshed metadata on the score page.

## 5. Task 003 — soft deletes

1. Merge → deploy ships hosting and rules. No migration (M1 already backfilled
   `deletedAt`).
2. Verify: homepage unchanged; projects and scores can no longer be hard-deleted
   from the client.

## 6. Task 004a — songbooks: model, editor, save

1. Merge → deploy ships hosting and rules. No migration (no songbook docs exist).
2. Verify (flag on, staging): save a homepage list as a songbook, edit it into a
   second version, open the first via the history.

## 7. Task 004b — songbook PDFs and covers

1. Merge → deploy ships hosting and storage rules. No migration.
2. Verify (flag on, staging): add covers to a songbook, generate one instrument's
   PDF from its page — cover, frozen numbers, deleted scores struck through.

## 8. Task 004c — songbook versions, publishing, public pages

1. Merge → deploy ships hosting. No migration, no rules change.
2. Verify (flag on, staging): re-pin a score with a newer version, publish a
   songbook, open its `/songbooks/…` URL logged out.

## 9. Task 004d — published marker and homepage

1. Merge → deploy ships hosting and the three `syncPublishedScores…` functions
   (Cloud Functions prerequisites: §3).
2. Run the rebuild once (dry run first):
   ```fish
   ENV_FILE=.env.prod-scripts.local npm --prefix functions run rebuild:published
   ENV_FILE=.env.prod-scripts.local npm --prefix functions run rebuild:published -- --execute
   ```
   With no songbooks in prod it changes nothing; it matters after M7.
3. Verify (flag on, staging): publishing a songbook adds its scores to the
   homepage within seconds; unpublishing removes them.

## 10. Task 005 — review comments

1. Merge → deploy ships hosting and rules. No migration.
2. Verify (flag on, staging): as a member, pin a comment on a score page and reply.

## 11. Task 006 — forks and lineage

1. Merge → deploy ships hosting, rules and the `swapSongbookEntryToFork` function.
2. Backfill: migrate to `202610311200` (dry run first). It rewrites every stored
   `.mscz` at the same path, keeping its download token. It's safe to re-run, and
   needs the key to read and write bucket objects. Have the backup of §0 current
   first.
3. Release the export app: it stamps uploads and resolves forks.
4. Verify: an old score's `.mscz` still downloads, and carries
   `cadernin-score-id` in its score properties; an edited copy uploaded into another
   project becomes a fork.

## 12. Task 007 — M6/M7 rehearsal (not launched)

Migrations `202610311300` and `202610311301` are registered as dataset migrations.
They block deployment until explicitly applied with
`--include-dataset --to=202610311301 --execute --forward-only`. Before that, read
[007-data-migration.md](007-data-migration.md), review the generated score-decision
manifest and mapping/omission report, and take backups. Rehearse
on the production clone in staging first. No flag change or M9 cleanup is included.

M6 journals original assignments, reconciles band memberships, moves score
containers and soft-deletes emptied source projects without removing their docs
or members. M7 creates published `project/songbook` collections with exact pins,
preserves existing journaled songbooks and rebuilds publication markers directly.
Style inference evidence and the remaining 33 deferred reviews are journaled separately.
Madeira Pirata is archived without deleting its scores/files; Festa Junina becomes
`carnaval-bh/festa-junina-2024`, retaining general style grouping.
No exporter release is needed for M6/M7: score IDs and Storage paths stay stable,
and legacy fields remain until M9. Rollback requires the pre-migration backup.

## Open

- **M1b semantics.** The export app has been creating `Acervo @<name>` projects in
  prod, so user projects with scores may exist. The audit decides between
  "CADERNIN sole owner of every project" and converting each project's map.
  No migration deletes scores or blobs either way.
- Later slices (002–007) append their steps here as they are merged.
