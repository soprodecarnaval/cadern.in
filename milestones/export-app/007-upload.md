# 007 — Upload

**Goal:** After export, upload the produced folder to cadern.in, reusing the
website's pipeline, with progress UI.

**Depends on:** 005 (folder) + 006 (auth). **Blocked on the prerequisites below.**

## Prerequisites — the shared upload path is broken

Both are pre-existing website bugs, not export-app work, but 007 cannot land
without them because it reuses `uploadScore` wholesale.

**1. Uploads write to a prefix nothing grants access to.** `uploadScore.ts:55`
builds `songs/${scoreId}/${revId}`, but the collection was renamed to `scores`
by migration `202604201809_songs_to_scores` and the real files live under
`scores/…` — confirmed from the `StorageFile.path` values recorded in Firestore,
e.g. `scores/acervo-deep-olha-pro-ceu/1/parts/olha pro céu - sax alto.midi`.
Meanwhile `storage.rules` matches only `scores/{songId}/{allPaths=**}`, so
`songs/…` falls through to the catch-all `allow read, write: if false`.

Fix is one line, but check the bucket for orphans at `songs/` first; a service
account with `storage.objects.list` is needed, which the current one lacks.

**2. `storage.rules` reads fields that no longer exist.** `canWriteSong` tests
`project.ownerId` and `project.collaboratorIds`, both removed by
`202604201900_projects_roles` in favour of `members`/`memberIds`. Even at the
right path the rule evaluates against undefined.

## Reuse

- `src/lib/parseUploadedFiles.ts` — `parseUploadedFiles(File[])` → `ParsedScore`
  (+ `validateParsedScore`).
- `src/lib/uploadScore.ts` — `getOrCreateDefaultProject(user)`,
  `uploadScore(parsed, projectId, user, onProgress)`.

Since 010, folders the export app produces carry a v2 `.metajson`, so
`parseUploadedFiles` takes the manifest path: part names and instruments are
read, not inferred. A self-produced folder should therefore upload with **zero
warnings** — anything else is a bug worth surfacing, not noise to be tolerated.

`ParsedPart` now carries both `name` (authored, arbitrary) and `basename` (the
file stem that keys Storage paths). Nothing in 007 needs to touch either; it
matters only if the upload UI wants to display part names.

## Bridging concern — resolved

`parseUploadedFiles` wants browser `File[]` and the assets are on disk. The
preferred option from the original plan is confirmed working:
`scripts/lib/backfillMetajson.ts` already reads a folder into `File[]` under
Node and hands it to `parseUploadedFiles` unchanged. Node ≥ 20 has `File`.

The bytes have to reach the renderer regardless — Firebase auth and Storage
uploads run there (006 reuses `src/auth.tsx`), so main cannot do the upload
itself. Main reads the folder and sends `{ name, bytes }[]`; the renderer
reconstructs `File` objects. For a typical export that is a few MB across one
structured-clone message.

## Steps

1. IPC `readExportFolder(dest)` → `{ name, bytes }[]`.
2. Renderer: build `File[]`, run `parseUploadedFiles` + `validateParsedScore`,
   surface warnings via `translateWarning` (pt-BR, as 011 established).
3. `getOrCreateDefaultProject(currentUser)` → `uploadScore(...)` with
   `onProgress` driving a progress bar.
4. Success state with a link/id; failures routed through the same
   code-and-translate path 011 introduced rather than raw messages.

## Files

- `electron/ipc.ts` (`readExportFolder`)
- `src/export-app/components/UploadPanel.tsx`
- `src/export-app/App.tsx`

## Acceptance

- One click after export uploads the score to the user's default project.
- A folder the export app produced uploads with no warnings.
- Progress and final success/failure are shown, in pt-BR.
- Uploaded files land under `scores/…`, matching existing content.
- Resulting score is visible in cadern.in.
