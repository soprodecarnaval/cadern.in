---
title: Format and upload scores in the browser
status: open
type: feature
milestone: browser-score-upload
---

# 015 — Browser score upload: sign-off and rollout

## Objective

MuseScore is only for editing. Contributors upload the `.mscz` as saved; the
caderninho formatting (clean-up, tuba notation, piratas, fit to one page)
happens in the browser, and the songbook PDF is built from the browser's
SVGs. This record holds the evidence for replacing the caderninhoFormatter
plugin and the export app, and the rollout steps.

## What ships

- `/:slug/enviar` (send and format) and `modo=reformatar` (reformat a stored
  revision), behind `VITE_FEATURE_FLAG_BROWSER_UPLOAD`.
- Every browser revision records the formatting profile and the renderer
  (library layout version, engine, renderer, asset manifest and font
  digests) in its `.metajson`, so it can be traced and re-rendered
  (`scripts/browserScore/rerender.ts`).
- Library pages name shared text fonts instead of embedding them; the reader
  and the PDF load the served font files.

## Rollout flag

`VITE_FEATURE_FLAG_BROWSER_UPLOAD` (deploy variable
`FEATURE_FLAG_BROWSER_UPLOAD`):

| Value | Project and songbook pages | Exporter |
| --- | --- | --- |
| unset / `off` | "Enviar partitura" opens the exporter link | in use |
| `beta` (or `true`) | the browser screen ("…no navegador") beside the exporter link | in use |
| `default` | only the browser screen; "Reformatar" for editors | retired after sign-off (plugin and export app removal) |

Steps: `beta` on staging, maintainers review; `beta` in production for one
carnival cycle of uploads; `default` after the sign-off below.

## Evidence (2026-11-21)

Run with `PART_PAGES_PROFILE`, `PART_PAGES_REFERENCE` (side-by-side with the
stored plugin-formatted SVGs) and `scripts/browserScore/midi.mjs`, on local
copies of production scores.

- **One page per part.** 46 plugin-formatted 2026 scores (267 parts) and 26
  scores of the previous collection with their stored SVGs (130 parts):
  every part fits one 171.7 × 98.2 mm page. 15 dense parts need tighter
  horizontal spacing (warning `SHEET_SPACING_TIGHTENED`); a handful need
  smaller fingering numbers (`FINGERINGS_REDUCED`).
- **Staff size.** Against the plugin's own staff sizes, the median is +2%
  on parts without fingerings and +7% on parts with them (2026 scores);
  +2.7% against the stored SVGs (130 parts). Per part, about half are
  within ±10%; the plugin itself is not consistent: 22% of pairs of parts
  with identical music in the same score differ by more than 10%.
- **Piratas.** Per note, the browser writes the same fingering as the plugin
  for 99.0% of 2299 notes in the plugin's own notation (positions or valves,
  per song); the rest are notes outside the instrument's table. Default is
  now positions (1–7) for every pirata part.
- **Clefs.** Concert tubas and sousaphones in F8vb; treble tubas at their
  own transposition; the transposed bass-clef sousaphone left alone.
- **MIDI.** 164 of 181 files match desktop MuseScore 3.6 exports (tracks,
  notes, ±1 beat, programs); the rest differ by up to 2.2 trailing beats or
  one note.
- **PDF.** `createSongBook` from library SVGs: same pagination and header
  layout, fingerings and markings drawn in Liberation Serif and selectable,
  1.03× the generation time of MuseScore SVGs, PDF less than half the size.
  Stored pages are 140–180 KB (MuseScore SVGs: median 235 KB).
- **Flows.** Against the emulators: new score, new version, songbook-scoped
  version with re-pin, fork, reformat (plugin-era and browser revisions),
  and a stale songbook link refused with nothing written.

## Known gaps

- Chord-symbol glyphs that use the Leipzig music font are drawn by the
  browser but fall back to a standard font in the PDF.
- Some files fail to open in the library: parts that can't be matched to
  the full-score MusicXML (two of 50 local scores), and a rest-count
  mismatch on one score.
- The low tuba notes below the 3-valve range (positions 8–12, or 4-valve pistons in valves notation),
  the valve-trombone rule and the tuba-46 exception
  await a brass player's review (see the test file).

## Sign-off

- [ ] Maintainers review the side-by-side pages of the sample set.
- [ ] Maintainers review one full songbook PDF built from browser pages.
- [ ] The three flag states have been exercised on staging.
- [ ] Decision: switch to `default`, then remove the plugin and the export app.
