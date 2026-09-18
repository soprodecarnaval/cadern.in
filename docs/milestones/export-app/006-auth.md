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

## Steps

1. Ensure the export-app Vite build loads the `VITE_FIREBASE_*` env vars.
2. Wrap the renderer root in `<AuthProvider>`.
3. Login UI: reuse `AuthModal` or a slim email/password form calling
   `useAuth().login`.
4. Show current user; provide logout. Gate the upload action on `currentUser`.

## Files

- `src/export-app/App.tsx` (wrap in provider, login gate)
- `src/export-app/components/LoginForm.tsx` (or reuse `AuthModal`)
- export-app env wiring

## Acceptance

- User can log in with cadern.in credentials and the session persists.
- Upload action is disabled until logged in.
