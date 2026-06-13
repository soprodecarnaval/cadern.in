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
