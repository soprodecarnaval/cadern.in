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

## Implementation and verification

- `npm run export-app:dist:mac` builds an arm64 DMG on this Mac;
  `export-app:dist:win` and `export-app:dist:linux` build x64 NSIS and AppImage
  artifacts. Output is under `_build/export-app/artifacts/`.
- The packaging step stages only the built main, preload, renderer, and a
  minimal package manifest. MuseScore is detected from the host installation.
- Build-time Firebase settings come from the same `VITE_FIREBASE_*` environment
  as the web app. The build fails if required settings are missing.
- Verified: macOS DMG mounted with an app and Applications shortcut; packaged
  macOS app opened its login screen, exposed the preload bridge, and resolved
  `/opt/homebrew/bin/mscore`. Windows x64 and Linux x64 artifacts built, but
  could not be launched on this Mac.
- Still needs manual acceptance: sign/notarize macOS for distribution, install
  and launch on Windows/Linux, and test authenticated export and upload from an
  installed artifact. Current macOS build is unsigned for local testing.
