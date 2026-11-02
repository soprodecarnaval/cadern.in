# Scripts

Run commands from the repository root. Existing npm command names are unchanged.

| Folder | Contents |
|---|---|
| `migrations/` | Migration CLI, ordered registry, versioned migrations and framework in `lib/` |
| `collab/` | Collab catalog planner, dataset helpers in `lib/`, reviewed manifests in `data/` |
| `maintenance/` | Environment cloning, project audits, asset verification and metajson backfills |
| `dev/` | Local emulator seeding |
| `packaging/` | Export-app staging and MuseScore plugin packaging |
| `lib/` | Shared Firebase, MuseScore and export utilities, also used by Electron |

Unit tests stay alongside their modules. Firestore migration tests live in
`tests/migrations/` and run with `npm run test:migrations`.

Examples:

```sh
npm run migrate
npm run migrate:up -- --include-dataset --to=202610311301 --forward-only
npx tsx --env-file=.env.local scripts/collab/planCollabMigration.ts
npx tsx scripts/maintenance/cloneData.ts --from=production --to=staging
npm run verify:assets
npm run backfill:metajson -- /path/to/exported-score
npm run emulators:seed
npm run plugin:package
```

Migrations and cloning default to dry run. The dataset migration command above
executes changes; review backups and the
[rollout runbook](../docs/milestones/collab-flow/DEPLOY.md) first. Clone environment
files and service-account key paths continue to resolve from the repository root.
The score-review generator in `docs/milestones/collab-flow/reports/007-score-review/`
exports its executable manifest to `collab/data/collabReviewedScores.json`.
