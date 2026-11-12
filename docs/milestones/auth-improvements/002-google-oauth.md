# 002 — Google OAuth

**Goal:** Add "Sign in with Google" on the website and the export-app, with
auto-linking against existing email/password accounts.

**Depends on:** Google provider enabled in the Firebase console (manual,
owner-side — not code).

## Decisions

- **Auto-link on collision.** If `signInWithPopup` throws
  `auth/account-exists-with-different-credential` for an email that already
  has a password-based account, fetch the pending credential and link it
  automatically (`fetchSignInMethodsForEmail` + `linkWithCredential`) rather
  than prompting the user to choose. No separate "link your account" step.
- Google accounts come back with `emailVerified: true` already, so they are
  unaffected by 000's verification gate.
- Both surfaces get it: website (`AuthModal.tsx`) and export-app
  (`LoginForm.tsx`), matching 006-auth's existing login-only scope for the
  export-app (still no register/reset UI there — Google sign-in is login,
  not account creation, from the export-app's perspective).

## Steps

1. `src/auth.tsx`: add `signInWithGoogle()` using `signInWithPopup` +
   `GoogleAuthProvider`. Catch `auth/account-exists-with-different-credential`
   and perform the auto-link before resolving.
2. `src/tsx/AuthModal.tsx`: add a Google button on both login and register
   tabs, calling the same method.
3. `src/export-app/components/LoginForm.tsx`: add a Google button; reuse
   `src/export-app/authMessages.ts` for any mapped error codes, add Google-
   specific ones as needed.
4. Confirm Electron's popup-based OAuth works in the renderer (Firebase JS
   SDK popup flow inside a BrowserWindow) — if it doesn't, fall back to
   `signInWithRedirect` for export-app only.

## Files

- `src/auth.tsx`
- `src/tsx/AuthModal.tsx`
- `src/export-app/components/LoginForm.tsx`, `src/export-app/authMessages.ts`

## Acceptance

- Website: new Google sign-in creates a verified account; existing email
  matching a password account auto-links instead of erroring.
- Export-app: same Google button works inside Electron (popup or redirect).
- No regressions to existing email/password login/register.
