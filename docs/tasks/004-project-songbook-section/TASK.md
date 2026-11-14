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
- Remove the standalone /project/:project_id/songbooks page; current implementation uses /projects/:slug/songbooks. Redirect old list URLs to their project page.
- Update navigation, breadcrumbs and post-create/delete destinations; retain member/all versus non-member/published-only visibility.

## Implementation plan

1. Iterate on mockups with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved mockups in this task directory.
2. Inspect PublicProjectPageView and ProjectSongbooksPageView; agree section mockups.
3. Reuse creation logic, update links and redirects, retire redundant page and associated stories.

## Validation

Browser-check creation, cancel, validation, empty states, role restrictions and legacy list redirects; no navigation ends on the removed list page.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None.

## Execution — 2026-11-14

- Implementation plan and [mockup v1](mockup-v1.html) approved in chat (`lgtm`).
- Creation moved into the project section; owner/admin only. Cancel resets the draft;
  invalid/duplicate titles and save failures preserve it; pending submission disables controls.
- Members retain all-songbook visibility, non-members published-only. Current songbook paths preserved.
- Legacy list route redirects with replacement to the project; back/delete destinations updated.
- Standalone list view/stories retired; project stories cover creation, permissions and recovery.
- Implementation accepted by the user in chat (`accept and move on`). Task completed.
- Shared C/008 handoff: [HANDOFF.md](HANDOFF.md). 005 and 006 remain open.

### Checks

- 20 focused project-page Storybook stories passed via the existing Playwright runner,
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
