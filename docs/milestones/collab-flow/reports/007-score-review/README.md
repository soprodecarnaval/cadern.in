# Task 007 score review

- [Interactive HTML](cadernin-score-chain-review.html)
- [All scores as CSV](cadernin-score-chain-review.csv)
- [Complete Markdown report](cadernin-score-chain-review.md)

The production metadata snapshot is read-only. Tags, predecessor links and
exclusions recorded here are review decisions, not database changes. They have
not yet been incorporated into the M6/M7 migration implementation.

## Review required

Select **Review required** in the HTML filter to find score rows with unresolved
styles, differing historical styles that need a choice, ambiguous predecessors,
tentative title matches or a missing latest revision. Each row states its reason.
Chain-supported style suggestions have their own filter.

Unmatched supplied index entries are separate: they have no identified score row
in the corresponding collection. Their table opens automatically with the review
filter. Search and source-project selection also filter that table.

Current report: 1,063 included scores, 33 score rows requiring review, 59 unmatched
index entries, and no ambiguous predecessors. Historical titles are retained.

## Recorded exclusions

Madeira Pirata is excluded as a project. These four Garota score IDs are excluded:

- `garota-2025-tapaonaraba`
- `garota-2026-tapaonaraba`
- `garota-2025-pequenaeva`
- `garota-2026-pequenaeva`

The earlier `garota-2024-tapaonaraba` reference was clarified as the 2026 duplicate.
The canonical `garota-2024-tapao-na-raba` and hyphenated 2025/2026 copies remain.
Removing both years' unhyphenated duplicates gives each remaining 2026 copy one
2025 predecessor.

## Regenerate offline

From the repository root, with Python 3:

```sh
python3 docs/milestones/collab-flow/reports/007-score-review/generate.py
```

The generator resolves inputs relative to its own location, so it also works from
another working directory. It uses only Python's standard library, needs no
credentials and performs no network requests. It recreates the HTML, Markdown,
full-score CSV and all four downloadable index-matching CSVs.

The source snapshot's `generatedAt` is the metadata read time, not a new cloud
read on each generation. Rebuilding reproduces that snapshot with the recorded
decisions; it does not refresh production or apply migrations.

## Inputs

- [Score snapshot](inputs/score-snapshot.json): original titles, metadata,
  revision inventory and original migration proposals for all 1,070 containers.
- [Review decisions](inputs/review-decisions.json): exclusions, project-wide and
  manual tags, Festa Junina classifications and permitted cross-project sources.
- [Title aliases](inputs/title-aliases.json): approved title-variation matches and
  existing style evidence. These permit links without renaming titles.
- `inputs/*-styles.json`: title-to-score matches from the supplied 2023/2024
  lists and the two screenshot indexes, including unresolved matches.
- `inputs/*-supplied.txt` and `inputs/*-transcription.txt`: supplied titles and
  screenshot transcriptions, with style labels singularized.

Matching uses normalized titles and reviewed variations. Predecessors prefer the
nearest available earlier year within the same destination project, using the
main annual songbook when that year has several candidates. The reviewed
cross-project references to `carnaval-bh/2024` are fallback links. An ambiguous
match remains flagged; it is never selected arbitrarily.

Year-specific tags remain distinct. A style suggestion for an unreviewed score
requires all reviewed style evidence in its linked component to agree.
