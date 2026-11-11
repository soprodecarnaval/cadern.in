# 001 — Storybook support

Status: completed

## Goal and decisions

Add Storybook to the project so screens/components can be browsed in their
different states outside the running app, as a step toward a visual
annotate-then-dispatch design workflow. Use `@storybook/react-vite` to reuse
the existing Vite setup. Pilot on a small set of components with data mocked
via props; defer emulator-backed/live-Firebase stories to later work.

## Architecture and implementation plan

1. Select matching Storybook packages compatible with React 18 and Vite 4;
   avoid an unrelated application-toolchain upgrade. Add dev/static-build scripts.
2. Use a dedicated Storybook Vite config. Do not load the app config or
   `loadAppEnv`: the gallery must build without Firebase credentials or emulators.
   Let the React-Vite framework configure React compilation.
3. Import production global styles in their existing order. Use MemoryRouter
   for routing where needed. Keep explicit component titles for stable story IDs.
4. Extract prop-driven views while retaining connected production wrappers and
   their existing import paths. No new data layer or Storybook module mocks.
   - SearchBar: inject collection status/search; wrapper reads collection context.
   - AuthModal: inject login/register/resetPassword; wrapper reads auth context.
   - PartItem: inject play/stop callbacks; wrapper retains MIDI integration.
   - ScoreCard: inject lineage content, part playback callbacks, and preview
     rendering; wrapper retains LineageBadge, PreviewModal, and MIDI integration.
   Views must not transitively initialize Firebase or audio. Preserve existing
   production props, state transitions, and behavior.
5. Add typed local fixtures and colocated stories for exactly five pilots:

   | Component | Required states/interactions |
   | --- | --- |
   | ScoreCard | Compact, expanded, no parts, highlighted metadata; interactive toggle and preview request |
   | PartItem | With/without MIDI link; preview, play, stop callbacks |
   | PaginationBar | First, middle, last, single page; controlled navigation |
   | SearchBar | Loading/error disabled, ready empty, entered query; fixture search results |
   | AuthModal | Login, registration, rejected login, reset pending/success/error; close/reopen |

   Use real controls and deterministic callbacks to reach internal modal states;
   states requiring interaction must be reproducible on direct story navigation.
   Use local assets for score previews/downloads; never fetch production media,
   Firebase, or external soundfonts. Do not invent unsupported UI states.
6. Ignore `storybook-static/`. Document commands, fixture locations, and how to
   add a story. Type-check Storybook config as well as stories.
7. Validate static and dev galleries, pilot interactions, and production builds.

Out of scope: live Firebase/emulators, a new data layer, external design-tool
integration, full routed screens, additional pilots, and unrelated cleanup.
Follow-on design-tool capabilities below are exploratory, not validated here.

## Validation

- `npm run build-storybook` succeeds without application environment files or
  Firebase credentials. Output contains stable per-story IDs.
- Open every pilot story in a browser, including direct iframe URLs; check
  rendering, callbacks, modal transitions, console errors, and network requests.
  Storybook build success alone does not establish runtime correctness.
- Run Storybook/config type checks, targeted lint, and existing unit tests
  relevant to changed production boundaries.
- `npm run build` passes with the normal application environment; record any
  pre-existing/environment failures separately.
- Follow repo conventions: no `.js` extensions in local import paths.

Unresolved questions: none.

## Implementation and verification — 2026-11-11

Implemented and reviewed; completion approved on 2026-11-11.

- Storybook 8.6.14 selected for the existing Vite 4 / React 18 toolchain.
- Four prop-driven views extracted; connected wrappers retain production
  import paths. PaginationBar needs no extraction. ScoreCard injects lineage
  and preview rendering; its gallery preview is a local SVG fixture, while
  production retains the existing full PreviewModal.
- 20 stories cover the five pilots. Auth play functions reach internal states;
  callback assertions cover part preview/play/stop and search result delivery.
- `npm run build-storybook` passes with no app environment files/credentials.
- Chromium checked every direct iframe URL in dev and static galleries.
  Static checks wait for Storybook's finished render phase, including play
  assertions. No console errors or external HTTP requests. Also verified
  card expansion/preview, pagination, and auth close/reopen interactions.
- `npm run typecheck:storybook`, targeted ESLint (including `.storybook/`),
  and `git diff --check` pass.
- `VITE_USE_EMULATORS=true npm test -- --run`: 34 files, 237 tests pass.
  No emulator server was required by these unit tests.
- `VITE_USE_EMULATORS=true npm run build` passes. Plain `npm run build`
  reaches Vite but fails the existing required-Firebase-env validation in
  this worktree; a real-credential production build remains unverified.
- Existing build warnings include bundle size and missing `VITE_APP_TITLE`
  in the demo build. No unrelated toolchain upgrades made.

## Context

The project's designer wants an LLM-enabled workflow that doesn't start with
typing into Claude Code: an overview of the app's screens in their different
states, annotated directly with the changes needed, then agents dispatched
per annotation to apply them. That requires something to generate the
overview from.

Storybook was picked as the foundation because it already renders components
in isolated states (empty/loading/error/filled) as stable, addressable HTML
(`storybook build` → static `storybook-static/`, with per-story URLs like
`iframe.html?id=button--primary`). That makes the mapping from an annotation
back to "which component/file/state" unambiguous, which a looser
screenshot-based approach (e.g. Playwright snapshots + a generic annotation
tool) would not give for free. The tradeoff: Storybook mostly covers
leaf/component-level states, not full routed-page flows, so multi-component
screens stay out of scope for now.

The intended follow-on steps (not part of this task, recorded here so the
"why" isn't lost):

- Push the built story gallery into a `claude.ai/design` design-system
  project (via the `DesignSync` tool / `/design-sync` workflow), grouping
  cards by component so the designer has a single overview to annotate.
- Designer annotates directly on that gallery — this is the part replacing
  "typing in Claude Code."
- Each annotation becomes a scoped prompt, dispatched as a separate agent
  pointed at the specific component/file + annotation text, run in parallel.
- Re-render the gallery after changes land, designer reviews, loop.

This task only covers getting Storybook itself working with a handful of
pilot stories (mocked props, no live Firebase) to prove the setup before
building any of the above.

### Git history

Started from `origin/main` at `19b7d7ce`, on branch `feat/storybook-support`,
worktree at `../cadern.in-storybook`. Rebased onto updated `origin/main` at
`7a82adf8` — that update touched `ScoreCard.tsx` and `PartItem.tsx`, two of
the five pilot components; verify their current props before writing stories
for them.
