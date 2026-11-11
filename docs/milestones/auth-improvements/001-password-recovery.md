# 001 — Password recovery polish

**Goal:** Confirm/clean up the existing forgot-password flow; explicitly defer
branded pages.

**Depends on:** nothing.

## Current state

`resetPassword` (`src/auth.tsx`) already calls `sendPasswordResetEmail`, wired
into `AuthModal.tsx`'s "Esqueci a senha" button. This works end to end today
via Firebase's default hosted action page and default email template.

## Decisions

- **Keep Firebase's default action pages/emails for now.** No custom
  `actionCodeSettings`, `continueUrl`, or in-app `/reset-password` handler
  page in this milestone — revisit as a later branding pass.
- This task is mostly verification + minor UX cleanup, not new plumbing.

## Steps

1. Verify the existing flow end to end against the real (non-emulator)
   project once Google OAuth (002) changes are in, so email/password and
   Google accounts don't interfere with each other's reset UX.
2. Check error-message coverage in `AuthModal.tsx` for reset failures
   (unknown email, rate limit) is reasonable.
3. No export-app work — it intentionally has no reset UI (`006-auth.md`).

## Files

- `src/auth.tsx`, `src/tsx/AuthModal.tsx`

## Acceptance

- Forgot-password still works after 000/002 land, with no auto-linking or
  verification-gating regressions.
