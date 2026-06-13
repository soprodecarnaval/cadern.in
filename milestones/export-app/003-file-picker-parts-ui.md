# 003 — File picker + parts UI

**Goal:** User picks (or drags) a `.mscz`; the app shows a parts table with
instrument label, compatibility state, and a per-part toggle (checked by default
for compatible parts; disabled + greyed for incompatible).

**Depends on:** 002.

No per-part page count (not available from `--score-meta`).
Selection is keyed by part `id` (names can repeat, e.g. two `Trumpet`).

## Steps

1. IPC `pickMscz()` → native open dialog (main process), returns path.
2. Renderer state: selected `.mscz` path + parts from `listParts`.
3. Drag-drop target on the window (accept `.mscz`).
4. Parts table component:
   - columns: toggle · name · instrument label
   - incompatible rows disabled, `opacity` reduced
   - toggle updates selection set (keyed by part `id`)
5. Empty/error states (no mscz, mscore not found, no parts).

## Files

- `electron/ipc.ts` (`pickMscz`)
- `src/export-app/App.tsx`
- `src/export-app/components/PartsTable.tsx`
- `src/export-app/components/FileDrop.tsx`

## Acceptance

- Selecting a score renders its parts with correct instrument labels.
- Incompatible parts (e.g. percussion) are visibly disabled and uncheckable.
- Same-named parts (two `Trumpet`) are independently selectable via `id`.
- Selection state is read back correctly for export.
