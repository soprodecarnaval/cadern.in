---
title: Separate public and member songbook routes
status: open
type: feature
milestone: collab-flow
---

# 008 — Separate public and member songbook routes

## Objective

Public songbooks live at /project/:pid/songbook/:sbid; member views use a distinct protected route.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: medium-large. Dependencies: 004. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Canonical project page: /project/:pid. Proposed member songbook route: /project/:pid/songbook/:sbid/manage; confirm during wireframes. Map existing slug/composite IDs explicitly.
- Project-page songbook links send project members to the member route and non-members to the public route.
- Member route checks membership of the songbook owning project before loading member-only data; logged-out and unrelated-project users cannot enter. Enforce access in backend/rules as well as UI.
- Public route displays only published content without review history or member controls, even for signed-in members.
- Redirect legacy /projects/:slug, /projects/:slug/songbooks/:songbookSlug and /songbooks/:slug/:songbookSlug appropriately, preserving revision queries only where authorized.

## Implementation plan

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Audit App routes, SongbookPageView, membership/data loaders and generated share links; agree navigation wireframes and route contract.
3. Separate public/member loaders, implement canonical routes and legacy redirects, update all internal/share links.

## Validation

Check anonymous, unrelated member and owning-project roles via direct links, refresh and navigation; reject unpublished public access and project/songbook ID mismatches; verify legacy redirects and public share URLs.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

Approve /manage member suffix?
