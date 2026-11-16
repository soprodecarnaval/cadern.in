---
title: Show project and pinned version in songbook score lists
status: open
type: feature
milestone: ux-improvements
---

# 005 — Show project and pinned version in songbook score lists

## Objective

Songbook score rows show $project/$version; omit $project/ for the songbook’s own project.

## Placement and dependencies

Milestone: [ux-improvements](../../milestones/ux-improvements/PLAN.md).
Difficulty: small. Dependencies: None. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Show owning project and the exact pinned score version, not latest available. Preserve score title and composer.
- Interpret own project as the songbook owning project, including public views; confirm this during wireframes.
- Keep foreign-project versions unambiguous; handle deleted/unavailable metadata without exposing private information.

## Implementation plan

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Inspect SongbookPageView row data and revision labels; agree wireframes and examples.
3. Add display metadata as needed without per-row redundant reads; render consistent labels.

## Validation

Check own-project, foreign-project, multiple memberships, anonymous public view, stale pins and missing/deleted score rows.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

Confirm own project = songbook project; version label format?
