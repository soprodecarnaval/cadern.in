# 007 — Upload

**Goal:** After export, upload the produced folder to cadern.in, reusing the
website's pipeline, with progress UI.

**Depends on:** 005 (folder) + 006 (auth).

## Reuse

- `src/lib/parseUploadedFiles.ts` — `parseUploadedFiles(File[])` → `ParsedScore`
  (+ `validateParsedScore`).
- `src/lib/uploadScore.ts` — `getOrCreateDefaultProject(user)`,
  `uploadScore(parsed, projectId, user, onProgress)`.

## Bridging concern

`parseUploadedFiles` expects browser `File[]`. The exported assets live on disk.
Options (pick in impl):
- Main process reads the folder and returns `{ name, bytes }[]`; renderer
  constructs `File` objects (`new File([uint8], name)`) and calls the existing
  functions unchanged. **Preferred** — zero changes to shared code.
- Or refactor `parseUploadedFiles` to accept a path-based source in Node.

## Steps

1. IPC `readExportFolder(dest)` → file list with bytes.
2. Renderer: build `File[]`, run `parseUploadedFiles` + `validateParsedScore`,
   surface warnings.
3. `getOrCreateDefaultProject(currentUser)` → `uploadScore(...)` with
   `onProgress` driving a progress bar.
4. Success state with a link/id; error handling.

## Files

- `electron/ipc.ts` (`readExportFolder`)
- `src/export-app/components/UploadPanel.tsx`
- `src/export-app/App.tsx`

## Acceptance

- One click after export uploads the score to the user's default project.
- Progress and final success/failure are shown.
- Resulting score is visible in cadern.in.
