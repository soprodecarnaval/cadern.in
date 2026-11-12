# 000 — Email confirmation on signup

**Goal:** Require email verification before a user is considered logged in.

**Depends on:** nothing.

## Decisions

- **Unverified users are not logged in.** `AuthProvider`'s `currentUser` (or an
  equivalent derived value) must be `null`-equivalent for the rest of the app
  whenever `user.emailVerified` is `false`. Every place that currently gates
  on "is there a Firebase user" gates on "is there a verified Firebase user"
  instead — website and export-app alike.
- **Default Firebase verification email/page for now.** No custom
  `actionCodeSettings` or branded verification page yet; revisit once 001's
  custom pages land.
- Users who sign up stay on an "verify your email" screen (not the normal
  signed-out `AuthModal`) with a resend button, so they know why they can't
  get in and aren't told to log in again with correct credentials.

## Steps

1. `src/auth.tsx`: call `sendEmailVerification(user)` at the end of
   `register()`. Expose an `emailVerified` flag (or fold verification into
   the existing `currentUser`, exposing `null` when unverified) and a
   `resendVerificationEmail()` method.
2. `src/tsx/AuthModal.tsx` / a new unverified-state screen: show "check your
   email to verify" with resend, reusing the modal shell.
3. `src/export-app`: same gating — `App.tsx`'s login gate must also check
   `emailVerified` before unlocking the rest of the app, with its own
   (non-Bootstrap) unverified-state view consistent with `LoginForm.tsx`.
4. Sweep call sites that read `currentUser` directly (both apps) to confirm
   none of them bypass the new verified check.

## Files

- `src/auth.tsx`
- `src/tsx/AuthModal.tsx`
- `src/export-app/App.tsx`, `src/export-app/components/LoginForm.tsx`

## Acceptance

- New signup receives a verification email; cannot use the app until clicked.
- Resend works and is rate-limited by Firebase itself (no extra throttling
  needed).
- Existing verified accounts are unaffected.
- Export-app enforces the same gate.
