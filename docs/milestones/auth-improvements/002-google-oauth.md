# 002 — Google OAuth

**Goal:** Add "Sign in with Google" on the website and the export-app, with
auto-linking against existing email/password accounts.

**Depends on:** Google provider enabled in the Firebase console (manual,
owner-side — not code).

## Decisions

- **Auto-link on collision, but Firebase still requires proof of ownership.**
  Firebase refuses to link a new provider to an existing account without the
  caller first authenticating as that account — there is no API to skip this,
  by design (otherwise anyone could take over an email/password account by
  just signing in with Google for that email). So "auto" here means: no
  separate account-settings page, no manual "link accounts" flow elsewhere —
  the password prompt happens inline, in the same moment, as part of the
  Google button's own flow. Implemented as `GoogleLinkRequiredError` thrown
  by `signInWithGoogle()`, carrying the pending Google credential; the UI
  catches it, asks for the existing password once, and calls
  `error.link(password)` which signs in and calls `linkWithCredential`.
- Google accounts come back with `emailVerified: true` already, so they are
  unaffected by 000's verification gate.
- Both surfaces get it: website (`AuthModalView.tsx`) and export-app
  (`LoginForm.tsx`), matching 006-auth's existing login-only scope for the
  export-app (still no register/reset UI there — Google sign-in is login,
  not account creation, from the export-app's perspective).

## Steps

1. `src/auth.tsx`: `signInWithGoogle()` using `signInWithPopup` +
   `GoogleAuthProvider`. On `auth/account-exists-with-different-credential`,
   throw `GoogleLinkRequiredError` (exported) carrying the email and pending
   credential, with a `.link(password)` method.
2. `src/tsx/AuthModalView.tsx`: a "Continuar com Google" button under the
   tabs; on `GoogleLinkRequiredError` shows an inline password-only form
   calling `error.link(password)`.
3. `src/export-app/components/LoginForm.tsx`: same Google button and
   password-link form, reusing `authMessages.ts` for error text.
4. `electron/main.ts`: added `setWindowOpenHandler` on the main window,
   allowing popups to `accounts.google.com` and the Firebase
   `*.firebaseapp.com/__/auth/handler` page — Electron denies `window.open`
   by default, which `signInWithPopup` depends on.

## Files

- `src/auth.tsx`
- `src/tsx/AuthModal.tsx`, `src/tsx/AuthModalView.tsx`
- `src/export-app/components/LoginForm.tsx`
- `electron/main.ts`

## Acceptance

- Website: new Google sign-in creates a verified account; existing email
  matching a password account prompts once for that password, then links.
- Export-app: same Google button and link flow inside Electron.
- No regressions to existing email/password login/register.
- **Not verified in this environment** (needs a real Google account, a real
  Firebase project with the Google provider enabled, and — for export-app —
  an actual Electron window): the `signInWithPopup` + `setWindowOpenHandler`
  path in Electron specifically should be smoke-tested on a real build before
  shipping; popup-based OAuth inside Electron has known rough edges and a
  fallback to `signInWithRedirect` may be needed if it doesn't work cleanly.
