---
title: Show project and pinned version in songbook score lists
status: in-progress
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
- Interpret own project as the songbook owning project, including public views; confirm this during mockups.
- Keep foreign-project versions unambiguous; handle deleted/unavailable metadata without exposing private information.

## Implementation plan

1. Iterate on mockups with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved mockups in this task directory.
2. Inspect SongbookPageView row data and revision labels; agree mockups and examples.
3. Add display metadata as needed without per-row redundant reads; render consistent labels.

## Validation

Check own-project, foreign-project, multiple memberships, anonymous public view, stale pins and missing/deleted score rows.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None. Approved: own project = songbook owning project; `v3` / `foreign-project/v3`.

## Approved implementation

Plan and [mockup v1](mockup-v1.html) approved in chat (`lgtm`): labels below titles in details,
reader index and selected editor rows; exact pinned revision; foreign project
slug; no extra reads; preserve missing-score behavior.

## Implementation and validation — 2026-11-14

- Shared `songbookScoreVersionLabel` resolves the explicit item revision, otherwise
  the loaded pinned revision. Prefix comparison uses the songbook owning project ID;
  viewer memberships do not affect the label.
- Details, public reader/search and selected saved-songbook editor rows show labels.
  Generic library/builder cards retain their existing metadata by default.
- Project titles are not used in labels, so duplicate/missing/deleted project titles
  do not make foreign projects ambiguous or introduce metadata reads.
- Deleted entries keep their labels; missing score/revision entries remain omitted
  with the original frozen numbering, as before (existing unit coverage retained).
- Reader metadata includes the composer. Selected editor metadata wraps to keep
  the project/version visible on narrow screens.
- 24 unit tests passed: `VITE_USE_EMULATORS=true npm test -- --run
  src/lib/songbook.test.ts src/lib/songbookReorder.test.ts`.
- 37 browser stories passed using the existing Playwright runner filtered to
  SongbookPage, SongbookReader and ScoreCard in an ignored local runner copy.
- Six desktop/mobile layout checks passed (details, reader, editor at 1200/390px);
  screenshots inspected; no overflow or clipped editor version labels.
- `npm run typecheck:storybook`, targeted ESLint, demo-config `npm run build`,
  and `git diff --check` passed. Build retains dependency eval/large-chunk warnings.
- No new dependencies, persistence changes or additional reads. Browser services
  mocked; no live Firebase writes. No route/member split work.
- Built atop accepted 004 on `workstream/b-songbook-ui-005`; PR targets `main`
  under the chat override and depends on #433. Shared coordination:
  [HANDOFF.md](../004-project-songbook-section/HANDOFF.md).
- Implementation ready for human review; task remains in-progress. 006 remains open.
