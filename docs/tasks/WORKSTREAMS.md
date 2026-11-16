# Planned work — three workstreams

Tasks remain in their owning milestones. Execute each stream top to bottom,
from easier work to harder work, subject to dependencies. Difficulty is relative,
not a time estimate. Every UI task requires wireframe iteration and approval
before implementation. No implementation is authorized by these task plans.

## A — Auth and invitations

| Order | Task | Milestone | Difficulty | Dependencies |
|---|---|---|---|---|
| 1 | [003 — Humanize auth errors](003-humanize-auth-errors/TASK.md) | Auth improvements | Small | None |
| 2 | [007 — Email invitations](007-email-project-invitations/TASK.md) | Collaborative Flow | Medium | None |

## B — Songbook UI

| Order | Task | Milestone | Difficulty | Dependencies |
|---|---|---|---|---|
| 1 | [004 — Consolidate project songbooks](004-project-songbook-section/TASK.md) | Collaborative Flow | Small | None |
| 2 | [005 — Project/version labels](005-songbook-score-version-labels/TASK.md) | UX improvements | Small | None |
| 3 | [006 — Cover preview modal](006-songbook-cover-modal/TASK.md) | UX improvements | Medium | None |

004 and 005 are similarly sized; 004 goes first to unblock stream C.

## C — Routes, review and exporter context

| Order | Task | Milestone | Difficulty | Dependencies |
|---|---|---|---|---|
| 1 | [008 — Public/member routes](008-public-member-songbook-routes/TASK.md) | Collaborative Flow | Medium–large | 004 from B |
| 2 | [009 — Songbook-scoped review](009-songbook-scoped-review/TASK.md) | Collaborative Flow | Large | 008 |
| 3 | [010 — Contextual exporter uploads](010-contextual-exporter-uploads/TASK.md) | Collaborative Flow; exporter integration | Large | 008, 009 |
| 4 | [011 — Exporter deep-link fallback](011-export-deep-link-fallback/TASK.md) | Collaborative Flow; exporter integration | Small–medium | 010 |

Start A/003 and B/004 first. C can iterate on wireframes while waiting for 004;
implement its route changes after 004. Finish isolated UI changes before broad
schema, authorization and packaged-app changes. Coordinate B/C edits to songbook
views rather than implementing conflicting changes concurrently.

## After all three workstreams

Begin only after A/B/C tasks 003–010 are completed and integrated together.
These are sequential follow-ups, not a fourth parallel stream.

| Order | Task | Milestone | Difficulty | Dependencies |
|---|---|---|---|---|
| 1 | [011 — Merge #432 and establish design system](011-design-system-foundations/TASK.md) | UX improvements | Large | All A/B/C integrated |
| 2 | [012 — Rename routes to pt-BR](012-pt-br-routes/TASK.md) | UX improvements | Large | All A/B/C integrated; 011 |
| 3 | [013 — Exporter Storybook stories](013-exporter-stories/TASK.md) | UX improvements | Medium | 011 |
| 4 | [014 — Managed article system](014-article-system/TASK.md) | UX improvements | Large | 011; PR #443 |

011 establishes the visual foundations before the broader URL compatibility work
in 012. Do not rename routes during A/B/C based on this later task. 013 can run
after 011 in parallel with 012; it must not move Electron code into the website
bundle. 014 replaces the hardcoded article data introduced by PR #443.

## Consolidated completed work

[002 — Search deduplication](002-search-deduplication/TASK.md) remains the single
canonical task in UX improvements. Removed empty duplicate directory 001; nothing
to reimplement. Preserve its completed status and implementation history.

## Decisions to settle during task planning

- 005: “own project” means songbook project? Version label format?
- 007: unregistered-email invitations? Baseline is existing accounts.
- 008: resolved — `/manage` suffix approved; canonical prefix for the whole
  project namespace is singular (`/project/:slug`), no legacy redirects.
  Superseded by task 012 GitHub-style top-level routes (no aliases).
- 009: resolved — no migration needed (collab-flow never deployed); threads
  keyed `songbooks/{id}/scoreThreads/{scoreId}_{revisionId}`.
- 010: resolved — fork-vs-version already automatic (unchanged); re-pin is
  automatic but gated by a hard staleness check on both score and songbook
  expected revisions (abort, no partial upload, on mismatch).
