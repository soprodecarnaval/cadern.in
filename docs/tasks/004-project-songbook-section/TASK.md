---
title: Consolidate songbooks on the project page
status: open
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

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Inspect PublicProjectPageView and ProjectSongbooksPageView; agree section wireframes.
3. Reuse creation logic, update links and redirects, retire redundant page and associated stories.

## Validation

Browser-check creation, cancel, validation, empty states, role restrictions and legacy list redirects; no navigation ends on the removed list page.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None.
