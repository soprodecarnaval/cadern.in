# 004 — Metadata form

**Goal:** Show editable metadata fields pre-filled from the score, labelled with
their cadern.in mapping. Values are used when writing the `.metajson` (005) and
when uploading (007).

**Depends on:** 003 (needs a loaded score).

## Fields & mapping

| UI label              | source metaTag | metajson key      |
|-----------------------|----------------|-------------------|
| Título (title)        | `workTitle`    | — (from filename) |
| Compositor (composer) | `composer`     | `composer`        |
| Trecho (sub)          | `source`       | `previousSource`  |
| Tags (tags)           | `lyricist`     | `poet`            |

## Steps

1. Read existing metaTags. Source options (decide in impl):
   - reuse the `--score-meta` JSON from 002, or
   - parse the mscz zip `.mscx`.
2. Form component with the four fields, pre-filled, editable.
3. Hold values in renderer state; no write yet (005 consumes them).

## Files

- `src/export-app/components/MetadataForm.tsx`
- `src/export-app/App.tsx`

## Acceptance

- Opening a score pre-fills all four fields from its metadata.
- Edits persist in state and are available to the export step.
