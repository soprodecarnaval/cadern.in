---
title: Preview songbook covers in a save/cancel modal
status: open
type: feature
milestone: ux-improvements
---

# 006 — Preview songbook covers in a save/cancel modal

## Objective

Pressing Capa opens a modal with image selection, cover preview, Save and Cancel.

## Placement and dependencies

Milestone: [ux-improvements](../../milestones/ux-improvements/PLAN.md).
Difficulty: medium. Dependencies: None. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Preview the existing cover and selected replacement for the selected instrument; show how the cover will appear in the generated songbook.
- Selection changes remain draft until Save; Cancel or modal dismissal discards draft and preserves saved cover.
- Keep existing format validation and permissions; show upload/save progress and recoverable failures; prevent duplicate saves.
- Persist through the existing songbook cover/revision workflow, refresh preview and generated output after save.

## Implementation plan

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Inspect SongbookGenerationPanelView and songbookCovers; agree modal wireframes.
3. Separate draft cover state from persisted state; implement preview and explicit save/cancel, clean up preview URLs.

## Validation

Check existing/no cover, PNG/JPEG, invalid files, replacement, cancel/dismiss, save failure/retry, instrument isolation, permissions and resulting PDF cover.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None.
