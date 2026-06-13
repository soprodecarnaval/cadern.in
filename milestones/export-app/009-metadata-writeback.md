# 009 — Metadata write-back to .mscz

**Goal:** Persist edited metadata back into the `.mscz` so the score file itself
carries the updated values (not only the exported `.metajson`).

**Depends on:** 004 (edited values). Consumed by 005 (export copy reflects them).

## Why zip editing

There is **no MuseScore CLI command to set metaTags** (`--score-meta` only
reads). An `.mscz` is a zip containing an `.mscx` (XML) with
`<metaTag name="workTitle">…</metaTag>` elements. Write-back =
unzip → edit those nodes → re-zip, preserving all other entries
(thumbnail, `*.audiosettings.json`, `META-INF`, etc.).

## Steps

1. Add a Node helper `writeMetaTags(msczPath, tags)` in the main process using a
   zip lib (`jszip` or `adm-zip`).
   - Read the entry list; find the `.mscx`.
   - Update/insert `<metaTag>` for `workTitle`, `composer`, `source`,
     `lyricist` (the cadern.in mapping from PLAN.md).
   - Re-zip preserving other entries and compression.
2. Robust XML edit: update existing node text, or insert a new `<metaTag>` if
   absent. Prefer a real XML parser over regex.
3. IPC `writeMetaTags(path, tags)`; called during export on the copied
   `dest/title.mscz` (before `mscore -j`).

## Files

- `scripts/lib/msczMeta.ts` (new)
- `electron/ipc.ts`, `electron/preload.ts`
- `src/export-app/App.tsx` (wire save)

## Acceptance

- After editing + saving, re-reading the `.mscz` (via `--score-meta`) shows the
  updated tags.
- Other zip entries are intact; the file still opens cleanly in MuseScore.

## Target (decided): exported copy only

The **source `.mscz` is never mutated.** Flow:

1. Copy source → `dest/title.mscz`.
2. `writeMetaTags(dest/title.mscz, tags)` — edit the copy.
3. Run `mscore -j` with `in: dest/title.mscz` so the exported SVG/MIDI/metajson
   reflect the edited metadata.

This also removes the "file open in MuseScore" hazard, since we only touch our
own copy.
