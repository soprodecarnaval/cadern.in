---
title: Launch exporter uploads from project and songbook contexts
status: open
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
2. Electron: `app.setAsDefaultProtocolClient`, `requestSingleInstanceLock`,
   `open-url` (macOS) + `second-instance` (Win/Linux) → IPC into the
   renderer. **Not yet implemented** — no protocol registration exists today
   (`electron/main.ts`); next stacked step after 008/009.
3. Website launch controls on the project page and the songbook-scoped score
   page (009); exporter's no-link / stale-link messages.
4. Remove `UploadPanel`'s manual project picker; wire deep-link context
   through `exportAndUpload`/`resolveUploadTarget` (reused as-is) into the
   existing upload pipeline; update packaging/docs.

## Validation

Exercise cold/warm packaged launches on supported OSes, no-link message, both project modes and songbook revision upload, auth continuation, tampered IDs, revoked permissions, stale score/songbook revisions (hard-abort, no partial upload), foreign-score fork handling, cancellation and retry without duplicate uploads.

Run focused tests and relevant type/build checks after implementation.

## Unresolved questions

None — resolved above.
