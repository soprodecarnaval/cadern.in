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

## Decisions

- **Target project is chosen, not assumed.** `getUserMemberProjects` filtered to
  editor-or-above, defaulting to the user's Acervo. Uploading only to a personal
  project would mean someone has to move every score before it can appear in a
  songbook.
- **An existing score becomes a new revision.** Export, spot a mistake, fix,
  re-upload is the normal loop.

## The collision that forced the second decision

`uploadScore` derives `scoreId` as `${projectId}-${slugify(title)}`, and both
`createScore` and `createRevision` use `setDoc`, which **overwrites**. Uploading
a score whose title matches one already in the project would therefore destroy
the existing revision 1 and its score document, silently. The website avoids
this only by having a separate `/upload/:scoreId` route for new revisions; a
fresh upload there has no collision check either.

`UploadPanel` derives the same id, looks the score up before anything is
written, and reports how many revisions exist so the outcome is stated before
the button is pressed.

## Steps

1. ✅ IPC `score:readExportFolder` → `{ name, bytes }[]`.
2. ✅ Renderer rebuilds `File[]`, runs `parseUploadedFiles` +
   `validateParsedScore`, surfaces warnings through `translateWarning`.
3. ✅ Project picker; `uploadScore(...)` with `onProgress`.
4. ✅ Success state naming the score id and revision number.

## Files

- `electron/ipc.ts`, `electron/preload.ts`, `src/export-app/global.d.ts`
- `src/export-app/components/UploadPanel.tsx`
- `src/export-app/App.tsx`

## Acceptance

Unverifiable without a real Firebase round trip — there is no emulator harness
yet, so none of these are ticked from inspection.

- [ ] Uploading after an export puts the score in the chosen project.
- [ ] A folder the export app produced uploads with **no** warnings.
- [ ] Progress and final success/failure are shown, in pt-BR.
- [ ] Uploaded files land under `scores/…`, matching existing content.
- [ ] Re-uploading the same score adds revision N+1 and leaves revision 1 intact.
- [ ] Resulting score is visible in cadern.in.

## Known gaps

- No link through to the score on the website; the success state names the id
  only. Opening it needs `shell.openExternal` and a base URL, neither of which
  the app currently has.
- Re-uploading an existing score does not refresh the score document's title,
  composer or tags — a pre-existing `uploadScore` behaviour, not introduced
  here, but newly easy to hit now that re-upload is a supported flow.
