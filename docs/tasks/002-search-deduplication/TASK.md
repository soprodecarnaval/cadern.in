---
title: Deduplicate published search results by project and fork chain
status: open
type: feature
milestone: ux-improvements
---

# 002 — Search deduplication

## Objective

Show one score per project and fork chain in homepage/library search: the newest
published descendant. Searching for “Abre Alas” should show three cards, one each
for Na Tora, Garota and Carnaval BH, when those are its published project chains.

## Requirements

- Group by owning project ID and connected fork ancestry, not title. Independent
  arrangements with the same title remain separate, including within one project.
- Select only live scores in live projects with a current `published` reference.
  Newer unpublished descendants cannot hide a published ancestor.
- Prefer the deepest published descendant, matching the existing project picker.
  Break equal-depth ties by newest score creation time, then score ID. “Newest”
  means chain position, not last revision upload or first-publication timestamp.
- Follow ancestry across project boundaries and unpublished/deleted intermediate
  scores. Such intermediates establish relationships but are never candidates.
  Missing ancestors and cycles must terminate safely and deterministically.
- Load the selected score's `published.revisionId`, never its unpublished latest
  revision. If that revision is missing, try the next eligible score in its group.
- Choose representatives before text search. Older matching metadata must not
  cause superseded cards to reappear. Preserve existing Fuse matching,
  highlighting, result ordering, pagination, and project filters.
- Empty-query results and counts use the same representatives.
- Remove the “add all” button from search results and its unused handler/props.
  Preserve individual score additions and drag-to-add.
- Preserve the full published collection for builder restoration: existing drafts
  referencing older scores must still restore. Saved songbooks and their pinned
  revisions remain unchanged. Removing an older restored score must not insert
  it back into search as an extra representative.
- Keep the project picker version selector and feature-flag-off behavior intact.
- No database/schema changes, migrations, or writes to staging data.

## Current implementation

- `src/CollectionContext.tsx`: `loadPublishedCollection` loads all published score
  documents and their published revisions. One collection currently supplies both
  Fuse search and `allScores`.
- `src/lib/scorePicker.ts`: `groupScoreVersions` already groups by project and fork
  component, sorting by ancestry depth, creation time, then ID.
- `src/tsx/App.tsx`: `allScores` restores the builder; add/remove handlers also
  mutate search results directly. Both need consideration when separating search
  representatives from the complete collection.
- `src/tsx/ScoreSearchResults.tsx` and `ScoreSearchResultTable.tsx`: counts and
  pagination consume the supplied result list.

## Implementation plan

1. Add a pure published-representative selector around the existing ancestry
   grouping. Keep candidate eligibility separate from the full lineage graph.
   Reuse existing ordering without altering the project picker's behavior.
2. Obtain complete lineage metadata once per collection load, including
   unpublished/deleted intermediates. Prefer one `getAllScores` read and derive
   eligible published candidates from it rather than issuing both a full-score
   query and a duplicate published-score query. Keep live-project filtering.
3. Resolve published revisions and select the first renderable candidate per
   ordered group. Retain all renderable published scores separately for restoring
   older builder items; reuse loaded revisions, avoiding duplicate requests.
4. Give `CollectionProvider` separate full-collection and search-representative
   data. Build Fuse only from representatives and return those for empty queries.
   Preserve flag-off behavior and the existing search/highlight API where possible.
5. Remove the search “add all” button and unused handler/props; remove its
   component only if no other callers remain. Review builder restoration, search
   exclusion of selected scores, individual add/remove, sorting and counts.
   Recompute from representative search results where necessary instead of
   directly reinserting a superseded score.
6. Add focused selection and collection/search integration tests, then run
   TypeScript, targeted ESLint, relevant Vitest suites, and a staging-mode build.
7. Browser-check seeded “Abre Alas” chains in three projects; verify result cards,
   empty search, highlighting, counts, individual add/remove, absence of “add all,”
   pagination, and restoration of an older score already present in the local builder.

## Validation

- Same-project chain collapses to its latest published descendant, including tied
  import timestamps and renamed descendants.
- Cross-project forks yield one representative per project; unrelated same-title
  scores remain independent.
- Unpublished/deleted descendants do not replace eligible ancestors; unpublished
  and deleted intermediates still connect the graph.
- Branching chains use the documented depth/time/ID ordering; missing ancestors,
  cycles, and missing published revisions behave deterministically.
- Searching metadata unique to a superseded ancestor does not resurrect that card.
- Published revision content is used even when an unpublished latest revision exists.
- Empty-query results and visible counts match representatives.
- “Add all” is absent; individual additions and drag-to-add still work.
- Previously saved builder entries referencing older scores restore; removing one
  does not introduce a duplicate search card.
- Project picker and flag-off regression checks pass.

## Unresolved questions

None. Depth/time/ID ordering follows the existing project picker.

## Approval and context

Plan approved, including removal of “add all.” Implement on
`feat/search-deduplication`, branched from main at `37bce5ca` after PR #416 merged.
This task belongs to the [UX improvements milestone](../../milestones/ux-improvements/PLAN.md).
Commit the plan before implementation; leave implementation changes uncommitted
until reviewed.
