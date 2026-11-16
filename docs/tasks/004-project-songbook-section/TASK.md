---
title: Consolidate songbooks on the project page
status: completed
type: feature
milestone: collab-flow
---

# 004 — Consolidate songbooks on the project page

## Objective

Remove the redundant songbook-list page; manage songbooks from the existing project section.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: small. Dependencies: None. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Move the new-songbook toggle and creation flow into the project page songbook section, preserving role permissions.
- Remove the standalone /project/:project_id/songbooks page; current implementation uses /projects/:slug/songbooks. Do not retain a legacy list route or redirect; old list URLs reach the existing not-found screen.
- Update navigation, breadcrumbs and post-create/delete destinations; retain member/all versus non-member/published-only visibility.

## Implementation plan

1. Iterate on mockups with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved mockups in this task directory.
2. Inspect PublicProjectPageView and ProjectSongbooksPageView; agree section mockups.
3. Reuse creation logic, update links, retire redundant page and associated stories.

## Validation

Browser-check creation, cancel, validation, empty states, role restrictions and legacy list not-found behavior; no navigation ends on the removed list page.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None.

## Execution — 2026-11-14

- Implementation plan and [mockup v1](mockup-v1.html) approved in chat (`lgtm`).
- Creation moved into the project section; owner/admin only. Cancel resets the draft;
  invalid/duplicate titles and save failures preserve it; pending submission disables controls.
- Members retain all-songbook visibility, non-members published-only. Current songbook paths preserved.
- Legacy list route and redirect component removed per approved PR feedback; back/delete destinations target the project.
- Standalone list view/stories retired; project stories cover creation, permissions and recovery.
- Implementation accepted by the user in chat (`accept and move on`). Task completed.
- Shared C/008 handoff: [HANDOFF.md](HANDOFF.md). 005 and 006 remain open.

### Checks

- 19 remaining focused project-page Storybook stories passed via the existing Playwright runner,
  filtered to `screens-publicprojectpage--*` in an ignored local runner copy.
- Browser checks passed: songbook back link and post-delete destination;
  desktop/mobile screenshots inspected, no horizontal overflow at 390px.
- `npm run typecheck:storybook` and targeted ESLint passed.
- `VITE_USE_EMULATORS=true VITE_FEATURE_FLAG_COLLAB_FLOW=true npm run build` passed,
  including TypeScript. Standard build requires absent Firebase config; demo values used.
- `git diff --check` passed.
- Local dependencies installed with `npm ci`; no manifest/lockfile changes or secrets.
- Limitations: browser data services mocked; no live Firebase writes or rules changes.
  Build retains existing large-chunk/protobuf eval warnings; local Node 26 exceeds
  `superstatic`'s declared supported versions.

## Approved PR correction — 2026-11-16

Removed the legacy list route and redirect adapter, plus its redirect story.
Old `/projects/:slug/songbooks` URLs now use the existing catch-all not-found screen.
Existing songbook detail/public routes remain. Plan and five-file staging approved
in chat (`lgtm`). This correction is carried through PRs #436 and #438.

Correction checks passed: 19 remaining project-page stories, direct browser
verification of not-found without redirect at the legacy list URL, Storybook
TypeScript, targeted ESLint, demo app build and diff check.
