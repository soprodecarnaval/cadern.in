# 005 — Export

**Goal:** Produce the cadern.in-ready folder for the selected parts:
`title.mscz`, `title-PART.svg` (multi-page), `title-PART.midi`, `title.metajson`.

**Depends on:** 003 (selection) + 004 (metadata).

## Steps

1. IPC `runExport({ msczPath, title, selectedParts, metadata, destDir })`.
2. Build the `mscore -j` job (reuse `generateAssets` pattern in
   `scripts/lib/mscz.ts`):
   - `[prefix, ".svg"]`, `[prefix, ".midi"]` → per-part outputs
   - `dest/title.mscz` → full-score copy (CLI handles mscz fine)
3. Run mscore; on success the dest dir exists.
4. Filter: delete exported assets for **unselected/incompatible** parts (CLI
   exports all excerpts; prune to the selection set).
   - Verify how `mscore -j` names files for **duplicate part names** (two
     `Trumpet`): does it collide, number them, or use excerpt names? Ensure
     final filenames are unique per part `id`; rename if needed.
5. Write `title.metajson` with cadern.in keys (`composer`, `previousSource`,
   `poet`) from the metadata form. If 009 is in place, the `title.mscz` copy
   already carries the edited metaTags (run write-back before `mscore -j`).
6. Return the dest folder path + a manifest of written files.
7. Progress + result UI; "Open folder" button.

## Files

- `electron/ipc.ts` (`runExport`)
- `scripts/lib/mscz.ts` (reuse/extend)
- `src/export-app/App.tsx` (progress, result)

## Acceptance

- Export yields a folder that the cadern.in UploadPage accepts unchanged.
- Only selected/compatible parts have assets.
- Unicode in names is preserved (no `é` loss — Node `fs`, not QML XHR).
- `.metajson` carries the edited metadata in cadern.in field names.
