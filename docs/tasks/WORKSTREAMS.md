# Workstreams — integration status and follow-ups

The A/B/C implementations below are on `main` as of `ae09ad97`.
The tables preserve the original order and dependencies; they are not an
execution queue. The linked task files track acceptance and validation
separately from merge status.

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

## Follow-ups

| Task | Status on `main` |
|---|---|
| [011 — Design system](011-design-system-foundations/TASK.md) | Foundations and adoption batches merged; final inventory/sign-off not recorded. |
| [012 — pt-BR routes](012-pt-br-routes/TASK.md) | Merged in #446. See [web app flows](../APP_FLOWS.md). |
| [013 — Exporter Storybook stories](013-exporter-stories/TASK.md) | Open. Keep Electron code out of the website bundle. |
| [014 — Managed article system](014-article-system/TASK.md) | Open. #443 introduced article pages, not managed authoring. |
| [015 — Browser score upload](015-browser-score-upload/TASK.md) | Merged behind a feature flag; rollout sign-off pending. |

## Consolidated completed work

[002 — Search deduplication](002-search-deduplication/TASK.md) remains the single
canonical task in UX improvements. Removed empty duplicate directory 001; nothing
to reimplement. Preserve its completed status and implementation history.

## Historical planning notes

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
