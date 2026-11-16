---
title: Establish and adopt a home/auth-based design system across the app
status: in-progress
type: feature
milestone: ux-improvements
---

# 011 — Design system and app-wide adoption

## Objective

Build a reusable design system from the merged home and auth screens, review its reference page in Storybook, then adopt it across the whole app. Workstreams A/B/C and [PR #432](https://github.com/soprodecarnaval/cadern.in/pull/432) are integrated into main.

## Placement and dependencies

Milestone: [UX improvements](../../milestones/ux-improvements/PLAN.md).
Depends on completion and integration of all three [workstreams](../WORKSTREAMS.md), including tasks 003–010. Execute before 012. Difficulty: large.

## Requirements

- PR #432 is merged (merge commit `0bd0280e`); verified its drag/keyboard guidance in the builder. No further merge needed. Implementation branch: `feat/011-design-system-foundations`, based on main `d1a69fe6`.
- Inventory the current home and auth screens after A/B/C, including shared BrandModal styles, Storybook support and existing Bootstrap usage. Use these screens as the visual baseline.
- Use Storybook for the component specimen/reference page and wireframe iteration. Show tokens, component states and home/auth compositions; obtain user approval before production extraction/adoption. Record approved direction and story references in this directory.
- Define reusable color, typography, spacing, border/radius and interaction tokens. Establish a small initial set of shared primitives based on actual repeated home/auth patterns, such as buttons, fields and modal surfaces.
- Start adoption in home/auth, then migrate the whole app: website pages, builder, project/songbook/review screens, dialogs, shared controls and the Electron exporter renderer. Inventory every surface and track adoption; retain task-specific layouts and behavior while replacing duplicated visual rules with shared tokens/primitives.
- Preserve auth, navigation, permissions, upload/export, PDF generation, reader and drag/keyboard behavior. Route localization remains task 012. Keep generated PDFs and static documents outside this UI migration.
- Document component usage, variants and accessibility conventions in Storybook. Include keyboard focus, disabled/loading, validation/error and responsive states.

## Implementation plan

1. Build the reference page in Storybook from existing home/auth patterns: colors, typography, spacing, borders, buttons, fields and modal surfaces, with hover/focus, disabled/loading, validation and responsive states. Iterate with the user and record approval before production adoption.
2. Extract shared color, typography, spacing, radius and focus tokens from the approved reference.
3. Establish reusable button, field and modal primitives using existing Bootstrap behavior; document variants and accessibility conventions.
4. Adopt the design system in home/auth and keep representative compositions in Storybook.
5. Verify responsive layouts, keyboard access, auth interactions, types and builds; resolve issues before wider adoption.
6. Make the whole app use the design system. Inventory website and exporter surfaces, propose migration batches and review affected screen wireframes/stories before each batch. Migrate remaining screens/dialogs/controls, remove superseded visual rules, update stories and validate each batch. Track coverage and document any explicit user-approved exceptions.

## Validation

- Preserve the merged #432 keyboard/drag guidance.
- Run focused type, lint, build and Storybook checks for changed files/components.
- Compare all migrated screens at mobile and desktop widths; check keyboard navigation, visible focus, contrast, loading/empty/error/permission states and relevant auth states.
- Reconcile a screen/component adoption checklist against website routes, dialogs and exporter screens; no remaining UI surface may use the old visual system without an explicit user-approved exception.
- Run website and exporter builds, relevant unit/integration checks and Storybook browser checks; verify real exporter UI separately because the current Storybook setup excludes Electron.
- Confirm no regressions to auth actions, account menu or builder drag/keyboard behavior.

## Unresolved questions

None blocking. Scope approved: Storybook reference page, shared foundations, home/auth adoption, then app-wide adoption. Agree detailed primitives and migration batches during Storybook review.

## Reference review — iteration 1

- Approved to build the Storybook reference first; production extraction/adoption awaits visual approval.
- Story: `Design System/Reference → Overview` (`design-system-reference--overview`).
- Source: `src/tsx/DesignSystem.stories.tsx`; story-only layout: `src/css/DesignSystemSpecimen.css`.
- Reuses existing BrandModal controls and actual Bootstrap modal behavior. Shows home/auth colors and type, proposed spacing scale, button states, editable/invalid/disabled fields, feedback and composition examples.
- Proposed accessibility adjustments are isolated to this reference: visible field focus and a red invalid border. Existing production styles suppress field focus and can override the invalid border; review this treatment before adoption.
- Hover/focus can be exercised with pointer/Tab; modal open/cancel and field clear have a story interaction check. Mobile widths use wrapping layouts.
- Production screens/styles remain unchanged in this iteration.

Reference validation passed: Storybook typecheck, targeted ESLint, static Storybook build and whitespace check. Chromium checked story render/play, field edit/clear, modal open/cancel and no horizontal overflow at 1280px and 390px. Static build preceded the final interaction-selector correction; the final source passed typecheck and live-browser checks. Existing Node engine and Storybook bundling warnings remain. Review URL: http://127.0.0.1:6006/?path=/story/design-system-reference--overview.

## Shared foundations and first adoption

- User approved reference and requested commit/continuation; reference/plans committed as `89481c16`.
- Added shared `--ds-*` tokens and native-prop/ref button/field primitives plus Bootstrap-backed modal primitive.
- Auth uses the primitives; landing adopts shared tokens and CTA styling. Existing branded dialogs share the token/control rules. Approved focus/invalid treatments are retained.
- Reference controls now exercise the actual primitives outside a modal, while its interactive modal exercises the shared surface. Modal interaction assertions wait for transition visibility.
- App build (dummy Firebase build values; no backend calls), Storybook build/typecheck and targeted ESLint pass. Focused Chromium checks pass at 1280/390px, plus all auth and landing stories. Auth-focused checks stub Firebase initialization in the browser only; callbacks remain fixture operations.
- Full existing story suite: 162/177 passed. Remaining failures include auth Firebase initialization without credentials, scoped-score audio isolation, a transient Vite outdated-request error and the reference transition assertion (fixed and rechecked). These broader harness limitations remain; do not report the full suite as passing.
- Adoption inventory and proposed batches: [ADOPTION.md](ADOPTION.md). Next review: Storybook `design-system-reference--project-batch`; production project migration awaits approval.

## Project batch

User approved project treatment and requested commit/continuation. Shared
foundations/home-auth batch committed as `af996213`. Migrated navigation,
auth entry control, project list/create/public/settings, new-songbook form and
not-found page. Added shared page/link support and size/destructive variants;
kept native link/deep-link navigation and Bootstrap field context.

Validation: 43/43 relevant static Storybook render/play checks pass; mobile
navigation/create/public/settings checked; app and Storybook builds, story
TypeScript, targeted ESLint and whitespace checks pass. Development-server
checks suffered reload interference from other worktrees; static checks avoid
that interference. Project migration remains uncommitted pending user review.
Next visual gate: builder/dialog batch in Storybook; see ADOPTION.md.

User approved both builder/dialog previews and requested committing the project batch. Per user preference, shared component exports and consumers now use `Button`, `Input`, `Modal`, `Link` and `Page` without a Design prefix. Batch 2 implementation is authorized; it has not yet been applied to production.
