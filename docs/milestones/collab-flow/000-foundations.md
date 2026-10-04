# 000 — Foundations

**Goal:** Everything later slices assume: the feature flag, a verified prod
baseline, a rules test harness, and the `ScoreRevision` naming in code and data.

**Depends on:** nothing.

## Decisions

- **Flag rename, not a new flag.** `FEATURE_FLAG_AUTH_ENABLED` becomes
  `FEATURE_FLAG_COLLAB_FLOW`, default `false`. It already gates every auth-facing
  surface, which is exactly the collab surface.
- **Rules are tested against the emulator, not deployed to find out.** Every later
  slice adds tests here before touching `firestore.rules` / `storage.rules`.
- **`revisions` → `scoreRevisions` is copied, not moved** (PLAN §1, M2b). The old
  subcollection stays until M9 so a rollback still reads.

## Steps

1. Rename the flag: `src/featureFlags.ts`, `src/vite-env.d.ts`, `vite.env.ts`
   (`FEATURE_FLAG_KEYS`), `src/tsx/App.tsx`, `src/CollectionContext.tsx`,
   `.env.example`, `.env.local`, `.env.staging`, `.env.production`, both deploy
   workflows. Missing/empty means `false`. **Manual (Gustavo):** set
   `FEATURE_FLAG_COLLAB_FLOW` for staging; leave prod unset.
2. Gate routes, not only nav links. Today `/upload`, `/projects/*` etc. are
   reachable by URL with the flag off (`App.tsx:186`); only the navbar hides them.
3. Prod audit (M0): confirm the bucket has nothing under `songs/` and that
   `202604201809_songs_to_scores` is recorded as applied.
4. Emulator harness: `emulators` block in `firebase.json` (firestore, storage,
   auth), `@firebase/rules-unit-testing` dev dep, a separate vitest project / config
   for rules tests, `npm run test:rules` wrapping `firebase emulators:exec`.
5. Baseline tests for the *current* `firestore.rules` / `storage.rules`, so the
   later rewrites show diffs in behaviour, not just in text.
6. M2: rename `Revision` → `ScoreRevision` in code — `types/docs.ts`
   (`zRevisionData`, `RevisionDoc`), `types/viewModels.ts` (`RevisionViewModel`),
   `src/lib/db.ts`, `src/lib/songbook.ts`, components. Pure refactor.
7. M2b: migration copying `scores/*/revisions/*` → `scores/*/scoreRevisions/*`
   (same ids, `isLatest` dropped). Flag-on code reads `scoreRevisions`; flag-off
   code keeps reading `revisions`. Add the `scoreRevisions` match under
   `scores/{scoreId}` alongside the existing rules (no collection-group rule).
8. `uploadScore` dual-writes: the `scoreRevisions` doc plus the legacy `revisions`
   doc (with `isLatest` flip) — PLAN §0. Release a new export-app build with it.

## Files

- `src/featureFlags.ts`, `src/vite-env.d.ts`, `vite.env.ts`, `.env*`,
  `.github/workflows/deploy-*.yaml`
- `src/tsx/App.tsx`, `src/CollectionContext.tsx`
- `firebase.json`, `package.json`, `vitest.rules.config.ts` (new), `tests/rules/` (new)
- `types/docs.ts`, `types/viewModels.ts`, `src/lib/db.ts`, `src/lib/songbook.ts`,
  `src/lib/uploadScore.ts`, components using `Revision*`
- `scripts/migrations/<ts>_score_revisions_subcollection.ts`, `scripts/migrations/index.ts`
- `firestore.rules`

## Acceptance

- No reference to `FEATURE_FLAG_AUTH_ENABLED` remains; flag-off build hides and
  blocks every collab route.
- `npm run test:rules` runs green against the emulator in CI-like conditions.
- `grep -rn "\bRevision\b"` finds no stale type names; `tsc` passes.
- After M2b, every score in prod has the same number of docs under
  `scoreRevisions` as under `revisions`; homepage and score pages unchanged.
- An export-app upload lands in both subcollections and shows on the flag-off
  homepage.
