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
Difficulty: large. Dependencies: 008 (integrated: commit record in
[008's TASK.md](../008-public-member-songbook-routes/TASK.md), route is
`/project/:slug/songbook/:songbookSlug/manage`). Execution order:
[workstreams](../WORKSTREAMS.md).

## Decisions (chat-approved, 2026-11-15)

- **No migration.** Collab-flow has never deployed (`FEATURE_FLAG_COLLAB_FLOW`
  default `false`), so there is no production data under the current
  score-scoped comment schema to inventory, map or archive. Ship the new
  schema from scratch; the legacy-mapping requirement below is dropped.
- **Schema**: `songbooks/{songbookId}/scoreThreads/{scoreId}_{revisionId}/comments/{commentId}`.
  Thread identity is the owning songbook plus the pinned `(scoreId, revisionId)`
  pair — not `songbookRevisions` (those are immutable per-save snapshots;
  keying on the container means unrelated songbook edits never reset a
  thread).
- **Authorization**: review (read/create/edit own/soft-delete own) is gated on
  reviewer role of the songbook's `projectId`, covering scores pinned from a
  foreign project. Mutating the score itself (metadata, new revision, delete)
  stays gated on the score's own `projectId`, unaffected — songbook membership
  never grants rights over a score you don't own.
- **Re-pin (same score, new revision)**: automatic, empty new thread — no
  dialog, no change from 005's existing "comments never carry over between
  versions" rule, just re-keyed per songbook instead of per score.
- **Fork-swap (`swapSongbookEntryToFork`) is the one exception**: still
  automatic (no dialog), but the new fork's thread is seeded by copying the
  old thread's comments in the same operation. Anchors stay valid because a
  fork's revision 1 is byte-identical to the revision it was forked from. The
  old thread is left in place (not deleted/merged) and stays reachable from
  the songbook's revision history — just no longer the live thread for that
  entry.

## Requirements

- Add member-only songbook-scoped score route under the agreed member route; score must belong to that songbook revision. Public songbook links may show published scores without private review data.
- Comments belong to a songbook and reference the entry score and pinned score revision. Two songbooks using the same score never share threads.
- Authorize review using the songbook project membership, including scores owned by another project. Do not grant mutation rights over that foreign score.
- Preserve anchors, replies, author edit/soft-delete rules; retain revision-specific history. A re-pin starts a separate version thread; unrelated songbook edits do not reset it.
- ~~Design migration~~ — dropped per the no-migration decision above.
- Supersedes collab-flow PLAN comment ownership and 005-review-comments for future implementation.

## Implementation plan

1. ✅ Wireframes iterated and approved: [mockup-v1.html](mockup-v1.html) — own-project score, foreign score (review yes/mutate no), fork-swap carrying comments forward, plain re-pin starting empty.
2. ✅ Schema and authorization model agreed (see Decisions above).
3. Implement schema, songbook-scoped reads/writes and rules; update songbook row links and remove global review entry points. **Not yet implemented** — next stacked step after 008.
4. ~~Migration~~ — dropped.

## Validation

Rules and integration checks: same score in two songbooks stays isolated, foreign-score review uses songbook permissions, non-members cannot read/write, anchors/replies work, re-pins isolate versions, unrelated songbook edits preserve threads, fork-swap copies comments with anchors intact.

Run focused tests and relevant type/build checks after implementation.

## Unresolved questions

None — resolved above.
