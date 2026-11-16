---
title: Launch exporter uploads from project and songbook contexts
status: completed
type: feature
milestone: collab-flow
---

# 010 — Launch exporter uploads from project and songbook contexts

## Objective

Exporter upload destinations come from a deep link launched on the relevant project or songbook-scoped score page.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: large. Dependencies: 008, 009. Execution order: [workstreams](../WORKSTREAMS.md).

## Decisions (chat-approved, 2026-11-15)

- **Fork-vs-version is already automatic, unchanged.** `resolveUploadTarget`
  (`src/lib/uploadTarget.ts`) already forks unconditionally when the exported
  file's identity names a score of another project — no prompt today, just an
  FYI notice in `UploadPanel`. 010's deep link work only removes the manual
  project `<select>`; it doesn't touch this decision logic.
- **Deep-link payload carries expected revision ids for staleness checks, not
  just identity**: `projectId` always; `scoreId` + `expectedScoreRevisionId`
  when launched against a specific score; `songbookId` +
  `expectedSongbookRevisionId` when launched from the songbook-scoped score
  page (009).
- **Staleness is a hard gate, all-or-nothing — not a silent partial
  success.** Before any upload write: if `scoreId` is present and the score's
  current latest revision no longer matches `expectedScoreRevisionId`, abort
  with no upload. If `songbookId` is present and the songbook's current
  `currentRevisionId` no longer matches `expectedSongbookRevisionId`, abort
  with no upload. Message points the user back to the originating page for a
  fresh link. Only if every present check passes does the export+upload (and,
  for a songbook-scoped link, the re-pin) proceed — automatically, no
  confirmation dialog, since staleness is already ruled out. A plain
  project-page upload with no `scoreId` has nothing to go stale, so it's
  unaffected.
- Supersedes the earlier "explicit confirm" design explored in chat
  ([decision-v1.html](decision-v1.html) records that comparison for context)
  — superseded by the staleness-gate approach above, which needs no per-upload
  click in the common case.

## Requirements

- Project page launches new-score or new-version upload within that project. Songbook-scoped score page launches a new version for that score in that songbook context.
- Opening exporter without a valid deep link shows a pt-BR message directing users to the relevant pages; do not allow proceeding to an unscoped upload.
- Define typed deep-link payload carrying project, optional songbook, score and expected revision IDs; treat supplied identifiers as untrusted. Revalidate current auth, permissions, membership and score/songbook relationship server-side at upload time.
- Specify cross-project score behavior explicitly: existing fork/ownership rules apply; songbook membership alone cannot authorize a foreign score mutation.
- Specify how successful upload updates or offers to update the songbook pin under existing role/concurrency rules; never silently re-pin all songbooks. **Resolved**: automatic re-pin gated by the songbook staleness check above.
- Support cold/warm launch on macOS, Windows and Linux, auth continuation, stale/deleted context, malformed links, cancellation and retries. No credentials in URLs.
- Supersedes the free-standing exporter destination selector from collab-flow 009 (`UploadPanel`'s project `<select>`); link exporter milestone to this task.

## Implementation plan

1. ✅ Re-pin/staleness contract agreed (see Decisions above).
2. ✅ Electron: protocol registration, single-instance lock, `open-url` +
   `second-instance`, cold-launch argv.
3. ✅ Website launch controls on the project page and the songbook-scoped
   score page (009); exporter's no-link / stale-link messages.
4. ✅ Removed `UploadPanel`'s manual project picker; wired deep-link context
   through validation into the existing upload pipeline; packaging config
   updated.

## Implementation

- `types/exportDeepLink.ts` (new): `ExportDeepLinkContext` payload
  (`projectId`, optional `scoreId`/`expectedScoreRevisionId`, optional
  `songbookId`/`expectedSongbookRevisionId`), `buildExportDeepLink`,
  `parseExportDeepLink`, `findExportDeepLinkArg`. Pure, dependency-free —
  shared by the website, Electron main and the renderer.
- `electron/main.ts`: `app.setAsDefaultProtocolClient("cadernin-export", …)`
  (with the `process.defaultApp` dev-mode exec-path form), single-instance
  lock, `open-url` (macOS) and `second-instance` (Windows/Linux) handlers,
  cold-launch argv check in `whenReady`. A pending context is held in module
  state until the renderer asks (`export:getContext`) or, if the window is
  already up, pushed directly (`export-context` event) — handles cold vs.
  warm launch and auth continuation (the context is held above the login
  gate in `App.tsx`, so it survives signing in).
- `electron/ipc.ts`: `registerIpc` now takes `{ getPendingExportContext }` as
  an explicit dependency rather than importing it from `./main` — that
  module runs app-lifecycle/protocol registration as load-time side effects
  that would otherwise fire against `ipc.ts`'s own import, including in
  tests that mock `"electron"` minimally.
- `electron/preload.ts` / `global.d.ts`: `getExportContext()` (pull, cold
  launch) and `onExportContext(callback)` (push, warm relaunch).
- `electron-builder.yml`: added `protocols:` (name + `cadernin-export`
  scheme) — registers `CFBundleURLTypes` on mac, the registry entry on
  Windows (nsis), and the `.desktop` MimeType on Linux.
- `src/lib/exportContext.ts` (new): `validateExportContext` — revalidates
  auth (editor role) and membership against the *given* `projectId` live,
  then checks any present expected revision against the live score/songbook.
  Returns a typed ok/invalid result with resolved display titles. A foreign
  score (its own `projectId` differs from the link's) is deliberately **not**
  checked against — review/upload authorization for it comes entirely from
  the link's `projectId`, matching `resolveUploadTarget`'s existing
  fork-vs-version logic (unchanged, reused as-is).
- `src/lib/songbook.ts`: `pinnedToRevision` — pins one score to a specific
  revision id (the one `uploadScore` just created), distinct from
  `repinnedContent` which compares against "latest".
- `src/export-app/exportAndUpload.ts`: unchanged except its return value now
  includes `revisionId` (previously discarded) — needed for the re-pin.
- `src/export-app/App.tsx`: deep-link context held in state above the login
  gate (`useExportContext`, pull + push); with no context, renders a
  blocking pt-BR message with no path to an unscoped upload — the
  `ExportApp` component (file drop, metadata form, upload) is simply never
  reached.
- `src/export-app/components/UploadPanel.tsx`: manual project `<select>` +
  inline "create project" form removed entirely. Validates the context on
  mount (loading/invalid/valid states) and **again right before the upload
  starts** — a deliberate addition beyond the written decision: the
  upfront check only proves the link was fresh when the panel mounted, but
  exporting (MuseScore CLI, then the upload itself) can take a while, so a
  second, cheap check right before the write closes that gap. After a
  successful upload, if the link named a songbook, re-fetches it for a
  **third** check (same staleness rule) before re-pinning — scoped to just
  the re-pin, not the whole operation: the score upload has already
  succeeded and can't be undone, so a songbook that moved on during the
  upload skips only the pin update (`"skipped-stale"`), surfaced as a notice
  rather than failing the result.
- Launch controls: `PublicProjectPageView` gets an "Enviar partitura" button
  (editor+, project-only link) next to "Partituras"; `SongbookScorePageView`
  gets an "Enviar nova versão" button (editor+ on the songbook's project)
  carrying `scoreId`/`expectedScoreRevisionId`/`songbookId`/
  `expectedSongbookRevisionId`. Both are plain `<a href>`s to the custom
  protocol, not app routes.

### Checks

- `tsc --noEmit`, `eslint`: clean across every changed/added file.
- `vitest run`: 289/289 passing, including new unit tests for
  `exportDeepLink` (round-trip, malformed/wrong-protocol/missing-projectId
  rejection, argv extraction), `validateExportContext` (editor-only,
  project/score/songbook not-found, score and songbook staleness, foreign
  score authorized purely by the given project), and `pinnedToRevision`.
- `npx vite build --config vite.electron.config.ts`: **succeeds** — both the
  renderer bundle and the Electron main/preload bundles compile, validating
  the `ipc.ts`/`main.ts` dependency wiring end to end.
- `npx vite build` (main website): succeeds.
- **Not verified in this environment, flagged rather than skipped**: actual
  OS-level protocol registration and cold/warm launch behavior on a packaged
  app (macOS `CFBundleURLTypes`, Windows registry, Linux `.desktop` MimeType)
  — needs real installers built per-OS and a GUI to click a link against a
  running/not-running app; electron-builder itself wasn't run. Live
  Firestore/auth interaction for `validateExportContext` in the real app
  (covered by unit tests against mocked services, not an emulator — no
  Java 21 available here, same gap noted in 009's TASK.md).

## Validation

Exercise cold/warm packaged launches on supported OSes, no-link message, both project modes and songbook revision upload, auth continuation, tampered IDs, revoked permissions, stale score/songbook revisions (hard-abort, no partial upload), foreign-score fork handling, cancellation and retry without duplicate uploads.

Run focused tests and relevant type/build checks after implementation.

## Unresolved questions

None — resolved above.
