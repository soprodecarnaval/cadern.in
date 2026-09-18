# 008 — Packaging

**Goal:** Distributable, double-click installers for macOS, Windows, Linux.

**Depends on:** a working app (001–007); can iterate earlier for smoke tests.

## Steps

1. `electron-builder.yml`: appId, product name, icons, targets
   (dmg, nsis/exe, AppImage).
2. Bundle main + preload + renderer (`dist-export-app`).
3. mscore strategy (decided): **not bundled.** Use the user's MS4 install via
   the autolocate + manual-locate + persisted-path mechanism from 002.
4. Inject `VITE_FIREBASE_*` at build time (build-arg / env), not committed.
5. Build scripts: `export-app:dist` (per-platform).
6. Smoke test each artifact.

## Files

- `electron-builder.yml`
- `package.json` (dist scripts)
- `build/` icons

## Acceptance

- Installable artifact on at least macOS (dev machine).
- App launches, autolocates mscore (or accepts a manual path), exports +
  uploads end-to-end.
- Missing-mscore path shows a helpful message + download link.
