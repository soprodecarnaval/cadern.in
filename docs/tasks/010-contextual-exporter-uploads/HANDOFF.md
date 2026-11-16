# C/010 — final task in workstream C

Status: implemented, typechecked/linted/tested, both the website and
Electron app build cleanly. Protocol registration and cold/warm launch on a
packaged app were not exercised in this environment (no GUI, no per-OS
installer build) — see TASK.md Checks. Branch:
`workstream/c-routes-review-uploads-010`, stacked on
`workstream/c-routes-review-uploads` (008+009, already merged via #437/#439).
PR base: `main`.

## Contract

- Deep link: `cadernin-export://upload?projectId=…[&scoreId=…&expectedScoreRevisionId=…][&songbookId=…&expectedSongbookRevisionId=…]`.
  Build with `buildExportDeepLink`, parse with `parseExportDeepLink`
  (`types/exportDeepLink.ts`) — both pure, no Electron/browser APIs, safe to
  import anywhere.
- The exporter has no manual destination picker anymore. No context → a
  blocking message, full stop, before `ExportApp` (file drop etc.) ever
  renders.
- Re-pin is automatic and staleness-gated three times over: once when
  `UploadPanel` resolves the context, once right before the upload starts,
  once right before the re-pin write specifically (the only one of the
  three that doesn't abort the whole operation on failure — the score has
  already uploaded by then).

## Files / conflict boundary

- New: `types/exportDeepLink.ts` (+ test), `src/lib/exportContext.ts` (+
  test).
- `electron/main.ts`: protocol/single-instance/open-url/second-instance,
  pending-context module state, `takePendingExportContext` export.
- `electron/ipc.ts`: `registerIpc` takes `{ getPendingExportContext }` as an
  explicit param (not imported from `./main`, to avoid forcing that
  module's app-lifecycle side effects into `ipc.ts`'s own import graph,
  including under test). `electron/ipc.test.ts` updated to pass it.
- `electron/preload.ts` / `src/export-app/global.d.ts`: two new bridge
  methods, additive.
- `electron-builder.yml`: added `protocols:` block.
- `src/export-app/App.tsx`: new `useExportContext` hook + `NoContext`
  component; `ExportApp` takes `context` as a required prop now.
- `src/export-app/components/UploadPanel.tsx`: rewritten — project picker
  removed, context-driven instead. `src/export-app/exportAndUpload.ts`:
  one-line additive change (return value gained `revisionId`).
- `src/lib/songbook.ts`: added `pinnedToRevision`, nothing existing changed.
- `src/tsx/PublicProjectPageView.tsx`, `src/tsx/SongbookScorePageView.tsx`:
  one new button each, additive.

## Validation

See TASK.md "Checks" for the full list of what ran (tsc, eslint, vitest
289/289, both vite builds) and what's unverified (packaged protocol
registration/launch on macOS/Windows/Linux, live Firestore interaction).

## Coordination

This was the last task in workstream C's assigned order (008 → 009 → 010).
No further handoff needed unless a new task is assigned.
