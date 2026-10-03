# 006 — Auth

**Goal:** Email/password login reusing the website's auth, gating the upload
step.

**Depends on:** nothing functional (can be built in parallel after 001), but
only matters once 007 exists.

## Reuse

- `src/auth.tsx` — `AuthProvider` + `useAuth()` (`login`, `register`,
  `resetPassword`). Pure Firebase client SDK; works in the renderer as-is.
- `src/firebase.ts` — config from `import.meta.env.VITE_*`; the export-app Vite
  build must supply the same env vars (`.env` parity with the website).
- Optionally `src/tsx/AuthModal.tsx` (react-bootstrap already a dep).

## Decisions

- **Login blocks the app.** Uploading is the point of it, and a session
  established up front is one less interruption mid-export.
- **Login and logout only.** Accounts are created and passwords reset on the
  website, which people need anyway to see songbooks. `AuthModal` is not
  reused: it is react-bootstrap and this app is plain CSS, so reusing it would
  drag Bootstrap into the Electron bundle for one form.

## Steps

1. ✅ Env wiring. `vite.electron.config.ts` sets `root: src/export-app`, and
   Vite's `envDir` defaults to `root` — so the repo-root `.env` was never
   loaded and the app would have built with no Firebase config at all. Fixed
   with `envDir: repoRoot`, plus the required-key validation and the
   `VITE_FIRESTORE_DATABASE_ID` default, now shared with the website through
   `vite.env.ts` so the two cannot drift.
2. ✅ Renderer root wrapped in `<AuthProvider>`.
3. ✅ `LoginForm` calling `useAuth().login`, with Firebase error codes mapped
   to pt-BR in `src/export-app/authMessages.ts`.
4. ✅ Signed-in e-mail and a logout button in the header.

## Files

- `vite.env.ts`, `vite.config.ts`, `vite.electron.config.ts` (env wiring)
- `src/export-app/main.tsx` (provider)
- `src/export-app/App.tsx` (login gate, session header)
- `src/export-app/components/LoginForm.tsx`
- `src/export-app/authMessages.ts`

## Acceptance

- ✅ User can log in with cadern.in credentials.
- ✅ Nothing else in the app is reachable until they do.
- Session persists across restarts — Firebase Auth uses IndexedDB in the
  renderer; **verify on a real relaunch**, not by inspection.
- The upload gate itself lands with 007, which is the thing being gated.
