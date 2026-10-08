# Export App — Plan

A cross-platform desktop application that exports a MuseScore `.mscz` into the
cadern.in-ready asset folder (per-part SVG + MIDI, full-score `.mscz`,
`.metajson`) and optionally uploads it to cadern.in.

It replaces the abandoned in-plugin export window (removed from
`plugins/`), which could not write files due to MuseScore 4's QML sandbox
(`QML_XHR_ALLOW_FILE_WRITE` disabled) and broken `writeScore(…, "mscz")`.

## Why Electron

- **Cross-platform** + double-click usable by non-technical band members.
- **Node access** in the main process (`child_process`, `fs`) — the exact
  capability the QML plugin lacked.
- **Maximal reuse** of existing TypeScript:
  - `scripts/lib/mscz.ts` — `detectMscore`, `generateAssets` (runs `mscore -j`)
  - `types/instrument.ts` — the cadern.in `Instrument` type
  - `src/auth.tsx` — Firebase email/password auth (`AuthProvider`/`useAuth`)
  - `src/lib/parseUploadedFiles.ts` + `src/lib/uploadScore.ts` — upload pipeline
  - `src/firebase.ts` — Firebase client config (via `VITE_*` env)
- **New:** `scripts/lib/scoreInstrument.ts` maps MS4 `instrumentId` → cadern.in
  `Instrument`. We do **not** reuse `src/instrument.ts`'s name-based
  `parseInstrument` here — it misses Portuguese part names (e.g. "Eufônio").

## Architecture

```
┌─ Electron main process (Node) ──────────────┐
│  electron/main.ts      window + lifecycle    │
│  electron/ipc.ts       IPC handlers          │
│    · pickMscz()                              │
│    · listParts(mscz)   → mscore --score-meta │
│    · runExport(...)    → mscore -j (mscz.ts) │
│  reuses scripts/lib/mscz.ts                  │
└──────────────┬───────────────────────────────┘
               │ contextBridge (electron/preload.ts)
┌──────────────┴─ Renderer (React, Vite) ──────┐
│  src/export-app/                              │
│    · file picker / drag-drop                  │
│    · parts table (toggles, pages, compat)     │
│    · metadata form (cadern.in mapping)        │
│    · <AuthProvider> login (reused)            │
│    · upload (reused parse + uploadScore)      │
│  reuses src/instrument.ts, src/auth.tsx, …    │
└───────────────────────────────────────────────┘
```

Node-only code stays in main; renderer talks to it over a typed `contextBridge`
preload. Firebase (auth + upload) runs in the renderer (network only).

## Metadata mapping (cadern.in ↔ MuseScore)

| UI field | mscz metaTag | metajson key (cadern.in) |
|----------|--------------|--------------------------|
| Title    | `workTitle`  | (from filename)          |
| Composer | `composer`   | `composer`               |
| Trecho   | `source`     | `previousSource`         |
| Tags     | `lyricist`   | `poet`                   |

(Confirmed against `readMetajson` in `src/lib/parseUploadedFiles.ts`.)

## Decisions (resolved)

- Electron (not Tauri/CLI) — cross-platform + TS reuse.
- Part list via `mscore --score-meta` (confirmed: JSON on stdout, wrapped in
  `{ "metadata": { parts: [{ id, name, instrumentId, … }] } }`). Compatibility
  + labels come from the `instrumentId` map, not part names.
- Monorepo: lives here under `electron/` + `src/export-app/`. `electron` +
  `electron-builder` are **devDependencies**; the website's Vite build never
  imports them, so the site bundle is unaffected.
- Auto-upload to cadern.in with an email/password login step, reusing
  `src/auth.tsx`.
- **MuseScore 4 only.** `detectMscore` targets MS4 paths (drop the MS3 path).
- **MuseScore is not bundled.** Autolocate the user's MS4 install per platform
  and pre-fill it; if not found, the user locates it manually (file picker).
  The chosen path is persisted. Cross-platform: macOS, Linux, Windows.
- **Metadata write-back to the `.mscz`** is supported by editing the zip's
  `.mscx` XML `<metaTag>` nodes in Node (no CLI path exists). Source-vs-copy
  target is an open question (see 009).
- Built incrementally, milestone by milestone.

## Milestones

| # | File | Goal |
|---|------|------|
| 001 | `001-electron-window.md` | Blank Electron window rendering a React app via a dedicated Vite build; dev/build scripts. |
| 002 | `002-mscore-integration.md` | Detect mscore; `listParts` via `--score-meta`; verify output format. |
| 003 | `003-file-picker-parts-ui.md` | Pick `.mscz`; parts table with compatibility, toggles, page counts. |
| 004 | `004-metadata-form.md` | Read + edit metadata fields mapped to cadern.in. |
| 005 | `005-export.md` | Run `mscore -j`; assemble cadern.in folder filtered to selected parts. |
| 006 | `006-auth.md` | Reuse `src/auth.tsx`; login screen + gated upload. |
| 007 | `007-upload.md` | Reuse `parseUploadedFiles` + `uploadScore`; progress UI. |
| 008 | `008-packaging.md` | electron-builder artifacts (dmg/exe/AppImage). |
| 009 | `009-metadata-writeback.md` | Write edited metadata back into the `.mscz` (zip/XML). |

Dependencies: 001 → 002 → 003 → {004, 005}; 004 → 009 → 005; 006 → 007;
008 last.

## Open risks

- **Duplicate parts:** same `instrumentId` + `name` (two `Trumpet`, two
  `Trombone`) must not collide in output filenames — disambiguate by part `id`
  (005).
- Single-instance: spawning `mscore -j` while the GUI is open — the converter
  path runs headless (`ConsoleApp` RunMode), but validate in 002.
- Renderer File objects for `uploadScore` (which expects browser `File[]`) —
  bridged from main-process reads; see 007.
