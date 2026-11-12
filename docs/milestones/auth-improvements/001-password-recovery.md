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

## Verification (post-000)

No code change needed: `resetPassword` never touches `currentUser`/
`pendingUser`, and every `useAuth()` call site in `src` reads `currentUser`
through the central `auth.tsx` state — so 000's verified-gate applies
everywhere without a separate sweep. Error handling in `AuthModal.tsx` for
reset failures is unchanged and consistent with how the rest of the modal
(login/register) surfaces Firebase errors today — translating just the
reset path to pt-BR would be inconsistent, so left as-is pending a broader
error-message pass later. Export-app confirmed to still have no reset UI.
Will re-verify end to end once 002 (Google OAuth) lands, per step 1.
