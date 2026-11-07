# 001 — Electron window

**Goal:** A blank Electron window that renders a React app built by a dedicated
Vite config, with dev (HMR) and production build scripts. No mscore, no UI
features yet.

**Depends on:** nothing.

## Steps

1. Add devDependencies: `electron`, `electron-builder`, `vite-plugin-electron`
   (or a manual main/preload build). Keep them out of `dependencies`.
2. `electron/main.ts` — create `BrowserWindow` with `contextIsolation: true`,
   `nodeIntegration: false`, load the Vite dev server URL in dev / `dist` in prod.
3. `electron/preload.ts` — empty `contextBridge.exposeInMainWorld("api", {})`
   stub (filled in later milestones).
4. `src/export-app/main.tsx` + `App.tsx` — minimal React root ("Export App").
5. `vite.electron.config.ts` — separate Vite build with `root` at
   `src/export-app`, output to `dist-export-app`.
6. `package.json` scripts:
   - `export-app:dev` — run Vite + electron concurrently
   - `export-app:build` — build renderer + main/preload
7. Add a typed global `window.api` declaration file for the preload bridge.

## Files

- `electron/main.ts`, `electron/preload.ts`
- `src/export-app/main.tsx`, `src/export-app/App.tsx`, `src/export-app/index.html`
- `vite.electron.config.ts`
- `package.json` (scripts + devDeps)
- `src/export-app/global.d.ts`

## Acceptance

- `npm run export-app:dev` opens a native window showing "Export App" with HMR.
- `npm run export-app:build` produces a runnable bundle.
- `npm run build` (website) and `npm run lint` still pass; no `electron`
  import leaks into the website bundle.

## Status: done

Implemented via `vite-plugin-electron`. Notes:

- **Pinned `vite-plugin-electron@^0.28.x`** — `1.x` targets Vite 5/6 and emits
  `Unknown input options: platform` warnings on this repo's Vite 4.5. The 0.28
  line is Vite-4-compatible and builds clean.
- `electron` ^42 as devDep. Renderer build → `dist-export-app/`; main/preload →
  `dist-electron/` (`main.js` + `preload.mjs`). main.ts references
  `preload.mjs` (ESM, since the package is `"type": "module"`).
- `vite.electron.config.ts` roots at `src/export-app` with
  `server.fs.allow: [repoRoot]` so later milestones can import shared `src/` and
  `scripts/` code.
- **`package.json#main` = `dist-electron/main.js`** so Electron finds the entry.
- **Pinned main/preload `outDir` to repo-root `dist-electron/`.** Because the
  vite root is `src/export-app`, the plugin defaulted to writing
  `src/export-app/dist-electron/`, which `main` couldn't find at launch
  ("Cannot find module … dist-electron/main.js"). Set
  `electron({ main: { vite: { build: { outDir } } }, preload: { vite: { build:
  { outDir } } } })` to the absolute repo-root path. Confirmed both `build` and
  `dev` now emit to repo-root `dist-electron/`.
- Added `dist-electron`, `dist-export-app` to `.gitignore`.
- Verified: `export-app:build` clean, `tsc --noEmit` clean, `npm run lint`
  clean. Website entry (`src/main.tsx`) does not import electron — site bundle
  unaffected. `npm run export-app:dev` window: **verify on a machine with a
  display.**

### Install caveat (Node < 22.12)

`electron@42` → `@electron/get@5` is ESM-only, but electron's `install.js` uses
`require()`. On Node < 22.12 (`require(ESM)` not yet default) the postinstall
fails with `ERR_REQUIRE_ESM`. One-time unblock:

```
NODE_OPTIONS=--experimental-require-module node node_modules/electron/install.js
```

Durable fix (TBD): upgrade Node ≥ 22.12 (+ `.nvmrc`/`engines`), or add `.npmrc`
`node-options=--experimental-require-module`.
