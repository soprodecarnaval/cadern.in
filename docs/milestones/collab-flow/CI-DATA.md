# CI migrations and staging data

## Service-account keys

In GitHub Settings → Environments, configure:

| Environment | Secret | Value |
|---|---|---|
| staging | `FIREBASE_SERVICE_ACCOUNT` | JSON key for a staging deploy account |
| production | `FIREBASE_SERVICE_ACCOUNT` | JSON key for a production deploy account |

Use accounts belonging to the corresponding project. The deploy accounts need
the existing Firebase deployment permissions, plus `roles/datastore.user`,
`roles/storage.objectAdmin` on their bucket, and `roles/firebaseauth.viewer` for
migrations (member-name backfills read Auth).

Existing environment variables `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`
and `CADERNIN_UID` also configure migrations.

Restrict the GitHub environments' allowed branches to trusted branches. Anyone
able to execute modified workflow code in these environments can use their keys.
Rotate keys according to your credential policy. Do not commit JSON credentials.
`FIREBASE_TOKEN` is no longer read by the two deploy workflows.

## Deployment

Both workflows install dependencies, build, authenticate, run
`npx tsx scripts/migrate.ts --execute --forward-only`, then deploy Firebase.
Unknown schema versions and rollbacks fail instead of replaying migrations.
No cleanup migrations run automatically. If migration fails, deployment stops;
the prior site remains live, but already-applied migrations are not rolled back.
Keep migrations compatible with the previous deployed site's reads.

Migrations run before rules to avoid deploying role checks before their member
documents exist. Future migrations that require new functions/rules must introduce
that dependency in an earlier release, or explicitly split the rollout.

Deploy runs are not cancelled by subsequent pushes. Avoid local cloning,
migrations or deployments while a deploy workflow is running; local scripts do
not share GitHub's concurrency lock.
Review pending migrations and take the backups in DEPLOY.md before the first
production deployment; automatic migration execution does not create backups.

## Clone data between environments

Cloning runs locally, outside CI, and defaults to dry run.
Pass `--from=<env>` and `--to=<env>`: `local`, `staging`, or `production`.
Production is forbidden as a destination, including another env file pointing at
the production project or bucket. Source and destination must use different
Firestore databases and Storage buckets. Inspect dry-run counts before executing.
Auth accounts, rules, indexes and deployed functions are not copied.

Before executing, back up the destination if needed and close it to users.
Quiesce its Firestore-triggered functions for the copy and migration window;
otherwise triggers can modify copied data or recreate documents. Resume functions
after migration and rebuild published
markers as described in DEPLOY.md. The script does not disable functions itself.

The clone recursively copies all Firestore collections, including descendants
of missing parent documents, and all Storage objects. It preserves timestamps,
object paths and download tokens; rewrites Firebase/GCS bucket URLs and document
references to the destination; maps CADERNIN's UID in document paths, fields and role maps.
Other UIDs remain historical identifiers; their users are not copied into Auth.
Storage file contents are copied byte-for-byte. External links or embedded URLs
inside files are not rewritten.

Firestore reads and Storage listing/copies are not an atomic production snapshot.
Use a quiet production window for a reproducible rehearsal. A failed copy can leave
the destination partially replaced; rerun it before using that environment. The clone writes a
running marker, which prevents migration until cloning finishes successfully.
The copied production schema version is committed at the end. Then dispatch the
staging deploy workflow to migrate the copied data before reopening staging.

Keep clone credentials locally. The production reader needs
`roles/datastore.viewer`, `roles/storage.objectViewer` on the production bucket,
and `roles/firebaseauth.viewer`. The staging writer needs `roles/datastore.user`,
`roles/storage.objectAdmin` on its bucket, and `roles/firebaseauth.viewer`.
Both mapped CADERNIN accounts must already exist in Auth.

The script independently reads `.env.<source>` and `.env.<destination>` from the
repository root. Existing settings are used; no clone-specific env file is needed:

| Setting | Fallback |
|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | Required service-account key path |
| `SCRIPTS_FIREBASE_PROJECT_ID` | `VITE_FIREBASE_PROJECT_ID` |
| `SCRIPTS_FIREBASE_STORAGE_BUCKET` | `VITE_FIREBASE_STORAGE_BUCKET` |
| `SCRIPTS_CADERNIN_UID` | `VITE_CADERNIN_UID` |
| `SCRIPTS_FIRESTORE_DATABASE_ID` | `VITE_FIRESTORE_DATABASE_ID`, then `(default)` |

Relative key paths resolve from the repository root. Conflicting script/web
project, bucket or UID values fail. Keys must belong to their configured projects.
Shell env settings do not override either file. `.env.production` is also read to
identify protected production resources. `local` uses its configured cloud
resources; this command does not target emulators.

Use Node 20.12+ (CI uses Node 24). Install dependencies with `npm ci` if needed,
then inspect a dry run:

```sh
npx tsx scripts/cloneData.ts --from=production --to=staging
```

To replace staging Firestore and Storage with production data:

```sh
npx tsx scripts/cloneData.ts --from=production --to=staging --execute
```

Other allowed pairs work the same way, for example `--from=staging --to=local`. If
`.env.local` points to staging's resources, that pair is rejected as a self-copy.

After cloning, apply staging migrations locally (`.env.local` must point to staging):

```sh
npx tsx --env-file=.env.local scripts/migrate.ts --execute --forward-only
```

Alternatively, dispatch the staging deploy workflow, which applies migrations
before deploying. No clone-specific GitHub secrets or variables are needed.

The script uses the databases and buckets configured in the selected files.
Emulator variables are rejected.
