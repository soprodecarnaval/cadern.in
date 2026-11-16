---
title: Scope score review pages and comments to songbooks
status: open
type: feature
milestone: collab-flow
---

# 009 — Scope score review pages and comments to songbooks

## Objective

Opening a score from a member songbook shows its pinned version and comments specific to that songbook.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: large. Dependencies: 008. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Add member-only songbook-scoped score route under the agreed member route; score must belong to that songbook revision. Public songbook links may show published scores without private review data.
- Comments belong to a songbook and reference the entry score and pinned score revision. Two songbooks using the same score never share threads.
- Authorize review using the songbook project membership, including scores owned by another project. Do not grant mutation rights over that foreign score.
- Preserve anchors, replies, author edit/soft-delete rules; retain revision-specific history. A re-pin starts a separate version thread; unrelated songbook edits do not reset it.
- Design schema/rules/indexes and migration explicitly. Existing score-scoped comments have no unique songbook owner: inventory first, propose archive/mapping, obtain approval before migration; never copy into all songbooks silently.
- Supersedes collab-flow PLAN comment ownership and 005-review-comments for future implementation.

## Implementation plan

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Agree score-page/thread wireframes and data model, including missing entry, changed pin and history states.
3. Implement schema, songbook-scoped reads/writes and rules; update songbook row links and remove global review entry points.
4. Prepare dry-run migration/report and approved migration strategy; update seeds and design spec.

## Validation

Rules and integration checks: same score in two songbooks stays isolated, foreign-score review uses songbook permissions, non-members cannot read/write, anchors/replies work, re-pins isolate versions, unrelated songbook edits preserve threads; migration dry-run reconciles counts.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

Legacy comment mapping/archive policy?
