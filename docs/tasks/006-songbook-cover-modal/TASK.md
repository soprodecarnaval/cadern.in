---
title: Preview songbook covers in a save/cancel modal
status: in-progress
type: feature
milestone: ux-improvements
---

# 006 — Preview songbook covers in a save/cancel modal

## Objective

Pressing Capa opens a modal with image selection, cover preview, Save and Cancel.

## Placement and dependencies

Milestone: [ux-improvements](../../milestones/ux-improvements/PLAN.md).
Difficulty: medium. Dependencies: None. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Preview the existing cover and selected replacement for the selected instrument; show how the cover will appear in the generated songbook.
- Selection changes remain draft until Save; Cancel or modal dismissal discards draft and preserves saved cover.
- Keep existing format validation and permissions; show upload/save progress and recoverable failures; prevent duplicate saves.
- Persist through the existing songbook cover/revision workflow, refresh preview and generated output after save.

## Implementation plan

1. Iterate on mockups with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved mockups in this task directory.
2. Inspect SongbookGenerationPanelView and songbookCovers; agree modal mockups.
3. Separate draft cover state from persisted state; implement preview and explicit save/cancel, clean up preview URLs.

## Validation

Check existing/no cover, PNG/JPEG, invalid files, replacement, cancel/dismiss, save failure/retry, instrument isolation, permissions and resulting PDF cover.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None.

## Approved plan

Plan and [mockup v1](mockup-v1.html) approved in chat. Per-instrument Save replaces global Save;
removal is a modal draft. Dismissal disabled during Save. Shared PDF first-page
layout supplies the preview. Generation uses persisted covers.

## Implementation — 2026-11-15

- Capa opens a per-instrument modal. Replacement/removal stays draft until Save;
  Cancel, ×, Escape and backdrop dismissal discard it. Save locks dismissal and
  duplicate submission; recoverable failures preserve the draft for retry.
- Global Salvar capas and inline removal retired. Existing permissions remain:
  current revision, owner/admin, authenticated user. Read-only generation remains.
- Shared `drawCoverPage` preserves PDF cover geometry; preview creates that PDF
  page and rasterizes it as an image using lazily imported PDF.js. Covers are
  centered/fit on the existing 18 × 13 cm landscape page, including default and
  carnival behavior. No native PDF embed dependency.
- `saveSongbookCovers` still uploads and creates a revision with unchanged entries
  and pins. It now rejects unsupported MIME types and returns persisted cover URLs
  so generation can immediately use the saved covers while parent data refreshes.
- File, temporary PDF and rendered preview URLs are cleaned on replacement,
  dismissal and completion; PDF.js document/worker resources are destroyed.

### Changed files

- `src/tsx/SongbookCoverModal.tsx`: draft selection, preview, save/cancel, recovery.
- `src/tsx/SongbookGenerationPanel{,View}.tsx`: modal wiring, saved-cover generation.
- `src/createSongBook.ts`, `src/lib/pdfPreview.ts`: shared cover drawing and rendering.
- `src/lib/songbookCovers{,.test}.ts`: returned URLs, format validation and save tests.
- Generation panel stories, screen/story fixtures: isolated UI coverage.
- `package.json`, lockfile: `pdfjs-dist@6.5.438` (CI uses supported Node 24).
- Task/milestone docs and shared [handoff](../004-project-songbook-section/HANDOFF.md).

### Validation

- 32 modal/songbook-page browser stories passed with mocked persistence.
- 18 unit tests passed:
  `VITE_USE_EMULATORS=true npm test -- --run src/lib/songbookCovers.test.ts src/lib/songbook.test.ts`.
- [check-preview.mjs](check-preview.mjs) passed against local Storybook:
  preview pixels equal the actual generated PDF first page for portrait PNG,
  landscape JPEG, carnival and default/no-image covers. Corrupt images rejected.
  Run `node docs/tasks/006-songbook-cover-modal/check-preview.mjs` with Storybook
  running. Uses installed local PDFKit/blob-stream and local fonts/assets only.
- Desktop/mobile (1100/390px) screenshots inspected; no horizontal overflow.
  Browser checks confirmed backdrop discard and preview/file URL cleanup.
- `npm run typecheck:storybook`, targeted ESLint, demo-config `npm run build`,
  `node --check` for the PDF check script and `git diff --check` passed.
- Demo build command:
  `VITE_USE_EMULATORS=true VITE_FEATURE_FLAG_COLLAB_FLOW=true VITE_APP_TITLE=cadern.in npm run build`.

### Dependencies and limits

- Stacked on accepted 005/#436 on `workstream/b-songbook-ui-006`; PR base `main`
  follows the explicit chat override. No route, schema, or rules changes.
- PDF.js is loaded when preview is requested: approximately 450 kB JS (135 kB gzip)
  plus a 1.27 MB parser worker asset in the demo build. Native PDF embedding was
  blank in browser checks, so the preview uses an image rendered from the PDF.
- No live Firebase upload or revision writes were performed. Persistence failures,
  retries and instrument isolation were checked through mocks/unit tests.
- Existing protobuf eval/large-bundle build warnings remain.
- Implementation ready for human acceptance; status remains in-progress.

### Exact staging set (17 files)

```text
docs/milestones/ux-improvements/PLAN.md
docs/tasks/004-project-songbook-section/HANDOFF.md
docs/tasks/006-songbook-cover-modal/TASK.md
docs/tasks/006-songbook-cover-modal/check-preview.mjs
docs/tasks/006-songbook-cover-modal/mockup-v1.html
package.json
package-lock.json
src/createSongBook.ts
src/lib/pdfPreview.ts
src/lib/songbookCovers.ts
src/lib/songbookCovers.test.ts
src/tsx/SongbookCoverModal.tsx
src/tsx/SongbookGenerationPanel.tsx
src/tsx/SongbookGenerationPanelView.tsx
src/tsx/SongbookGenerationPanel.stories.tsx
src/tsx/screenFixtures.tsx
src/tsx/storyFixtures.ts
```
