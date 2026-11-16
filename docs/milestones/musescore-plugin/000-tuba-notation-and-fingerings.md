# 000 — Tuba notation modes and tuning-aware fingerings

Status: in-progress

## Objective

Support Bb and Eb tubas/sousaphones with a shared default written part and correct
instrument-specific fingerings, plus optional transposed notation modes.

## Decisions

Agreed with tuba players, recorded 2026-11-11:

- Default: concert pitch-class notation in bass clef, written one octave above
  sounding pitch. Use bass clef with an 8 below (sounds one octave lower).
  This is octave-transposing notation, not literal sounding-octave concert notation.
- Example: sounding Bb1 is written Bb2, for both Bb and Eb instruments.
- Raise the written register to reduce ledger lines. Bb and Eb players share
  the same notation. Trombone/euphonium players can read the same notes at their
  written octave by disregarding the octave indication.
- Offer transposed treble and transposed bass clefs as optional modes.
- Preserve optional one-char fingerings, off by default.

Additional decisions approved after reviewing notation conventions:

| Mode | Bb written-to-sounding | Eb written-to-sounding | Examples |
| --- | --- | --- | --- |
| Default bass, 8 below | -12 semitones | -12 semitones | Bb2 → Bb1 on either tuning |
| Optional transposed bass | -14 semitones (Brazilian octave-raised convention) | -9 semitones | Bb: C3 → Bb1; Eb: C3 → Eb2 |
| Optional transposed treble | -26 semitones | -21 semitones | Bb: C4 → Bb1, G4 → F2; Eb: C4 → Eb2, G4 → Bb2 |

C4 means middle C. The optional Bb bass mode deliberately uses the Brazilian
major-ninth convention, rather than the continental major-second variant.
Research references: [Bb tuba conventions](https://www.vsl.co.at/academy/brass/contrabass-tuba),
[Eb tuba conventions](https://www.vsl.co.at/academy/brass/bass-tuba), and
[Brazilian band practice, printed p. 22](https://files.cercomp.ufg.br/weby/up/269/o/RAFAEL_CALDEIRA.pdf#page=22).

- Instrument ID is authoritative for the plugin's tuning and target notation
  policy. This supersedes the earlier suggestion to infer mode from clef and
  transposition. Formatting applies the ID's policy even to customized parts.
- Read existing clef/transposition as needed to preserve sound during conversion,
  not to select the target policy. Changing notation mode must be represented
  through the agreed instrument-ID mapping.
- Retain the existing current/all-parts checkbox as the scope of mode changes.
- Implementation approved: `tuba` also selects `concert-octave`. Keep its
  existing tuning fallback (Bb unless an Eb/E♭ part name identifies Eb).
- `transposed-bass` notation work is deferred by explicit user decision.
  Preserve existing notation for `bb-sousaphone`; its Bb sounding-pitch fingerings
  remain available. No new transposed-bass instrument definitions in this phase.

## MuseScore instrument-ID research

Checked against MuseScore 4.7.5, matching the installed application.
Native defaults and the plugin's planned target modes are shown separately.
Target intervals are written-to-sounding; `concert-octave` requires formatting
the native concert-pitch definitions to the agreed octave-raised notation.

| Instrument ID | Tuning | Native clef in transposed display | Native semitones | Plugin mode | Target semitones |
| --- | --- | --- | --- | --- | --- |
| `bb-tuba` | Bb | Bass | 0 | `concert-octave` | -12 |
| `bb-tuba-treble` | Bb | Treble | -26 | `transposed-treble` | -26 |
| `bass-eb-tuba` | Eb | Bass | 0 | `concert-octave` | -12 |
| `eb-tuba` | Eb | Bass | 0 | `concert-octave` | -12 |
| `eb-tuba-treble` | Eb | Treble | -21 | `transposed-treble` | -21 |
| `sousaphone` | Bb | Bass | 0 | `concert-octave` | -12 |
| `bb-sousaphone` | Bb | Bass | -14 | `transposed-bass` | -14 |
| `bb-sousaphone-treble` | Bb | Treble | -26 | `transposed-treble` | -26 |
| `tuba` | Bb fallback; Eb name override | Bass | 0 | `concert-octave` | -12 |
| No dedicated native ID: Bb tuba, transposed bass | Bb | — | — | `transposed-bass` | -14 |
| No dedicated native ID: Eb tuba/sousaphone, transposed bass | Eb | — | — | `transposed-bass` | -9 |

The Bb transposed-bass sousaphone ID already exists, but a distinct tuba ID does
not. Eb sousaphone IDs for `concert-octave` and `transposed-treble` are also absent;
the corresponding Eb tuba IDs above provide tuning/mode definitions, but the
representation for Eb sousaphones remains to be decided.

Treble variants specify bass clef in concert-pitch display. Defaults are assigned
by the instrument template and can subsequently be customized. `sousaphone` and
`bb-sousaphone` have different native transpositions; do not assume their notation
is equivalent merely because both are Bb instruments.

Other tuba IDs include `f-tuba`, `bass-f-tuba`, `c-tuba`, and
`subcontrabass-tuba`; these are outside the Bb/Eb task scope. The reviewed set
has no dedicated Eb sousaphone, Eb transposed-bass, or concert-plus-octave template.

Since MuseScore 4.6, `part.instrumentId` exposes the specific MuseScore ID.
Earlier versions exposed the broad MusicXML sound ID (e.g. `brass.tuba`), now
available as `part.musicXmlId`. Broad legacy IDs cannot encode the same policy
without an explicit compatibility decision.

Sources: [4.7.5 instrument definitions](https://github.com/musescore/MuseScore/blob/v4.7.5/share/instruments/instruments.xml#L5876-L6109),
[plugin API ID semantics](https://github.com/musescore/MuseScore/blob/v4.7.5/src/engraving/api/v1/part.h#L60-L71).

Implement the mode mapping above for concert-octave and transposed-treble.
Missing transposed-bass IDs/custom definitions are deferred. Keep `brass.tuba`
as a legacy generic alias with the same tuning fallback as `tuba`.

## Requirements

- Keep instrument tuning (Bb/Eb), sounding pitch, and notation mode distinct.
- Derive fingerings from sounding pitch and instrument tuning. Switching clef,
  notation mode or concert-pitch display must not change the fingering for the
  same sounding note.
- Preserve sounding pitch, rhythm, ties and score content when changing notation.
  Avoid double octave shifts when applying a mode repeatedly.
- Support both tuba and sousaphone variants; audit MuseScore instrument IDs
  rather than inferring tuning from clef alone.
- Preserve existing valve-combination/one-char options and tied-note handling.
- Apply notation controls to current/all parts using the existing checkbox; preserve existing
  formatting workflows and undo behavior.
- Provide English and Portuguese labels for new controls.

## Implementation plan

1. Verify MuseScore runtime pitch, instrument transposition and octave-clef
   semantics using Bb/Eb fixtures in concert/transposed display.
2. Validate the agreed mode intervals above against MuseScore configuration.
3. Finalize authoritative ID-to-tuning/mode mapping, missing modes and legacy IDs;
   determine how users select the corresponding instrument definitions.
4. Propose implementation details for approval before code edits.
5. Implement notation conversion and tuning-aware fingering routing.
6. Add focused regression coverage and manually validate in MuseScore.

## Validation

- Same sounding passage on Bb/Eb instruments produces identical default notation
  with tuning-specific fingerings; e.g. written Bb2 sounds Bb1 in both parts.
- Check low, middle and high register reference notes against player-approved
  Bb/Eb fingering expectations, in both fingering formats.
- Verify notation-mode/display changes preserve sound and fingerings.
- Verify every interval/example in the mode table; customized parts must converge
  to their instrument ID's target policy while preserving sounding pitches.
- Check octave clef playback, key signatures, repeated application, undo, ties,
  and current/all-parts behavior in MuseScore.
- Run `node --test plugin/tests/*.test.mjs` and `git diff --check`.

## Remaining investigation

- MuseScore runtime pitch and octave-clef semantics.
- Missing transposed-bass definitions and Eb sousaphone IDs (deferred).
- Notation formatting requires MuseScore 4.6 clef APIs; normalizing customized
  instrument transpositions requires 4.7 instrument replacement APIs.

## Implementation

- `musescoreInstruments.js`: one ID switch returns shared fingering settings and
  optional tuba policy. Fingering and notation consumers use this resolver;
  legacy-ID reset eligibility is also defined there. Bb uses sounding pitch +2
  and Eb uses sounding pitch -3 to index the existing C-based tuba table.
  This replaces the conflicting `bass-eb-tuba` -12 fingering offset and adds
  explicit concert/treble IDs. Explicit tuning IDs override misleading labels.
- `tubaNotation.js`: applies the ID's clefs through the existing Set style action.
  Concert-octave uses F8vb in both score displays; treble uses G in transposed
  display and F in concert display. No note pitches are shifted. Repeated
  formatting updates existing clefs rather than adding duplicate octave shifts.
- Customized transpositions are reset to the same instrument template when the
  4.7 API is available, restoring long/short display names afterward. This reset
  uses the template's instrument definition, including sound and part name.
  Parts containing instrument changes are skipped for notation conversion;
  their time-dependent notation needs separate support.
- Existing one-char and dynamic trombone options remain off by default.
  Fingering layout now handles rests/empty segments and a single repeated pitch.

## Verification

- `node --test plugin/tests/*.test.mjs`: 13 tests passed. Coverage includes ID
  policies, Bb/Eb reference harmonics, valve/one-char options, independent
  trombone state, repeated clef application, customized transposition handling,
  missing clefs, and actual QML traversal over rests/ties/single-pitch passages.
- `git diff --check`: passed.
- Actual MuseScore 4.7.5 formatter loaded through a temporary extension and ran
  on the original Eb fixture and a native-generated mixed-ID fixture. Saved
  output has F8vb for concert-octave IDs, the native F/G pair for treble IDs,
  and unchanged notation for deferred/other IDs.
- Committed smoke QML also passed on normal and customized-transposition inputs:
  repeated formatting and both concert/transposed displays preserved note pitch,
  concert spelling, timing and tie status. The customized Bb instrument reset to
  its native zero transposition before the octave clef was applied.
- Original Eb fixture's before/after MIDI exports were byte-identical.
- MuseScore sometimes crashed at CLI shutdown, including baseline conversions.
  The exported score assertions and MIDI files were checked independently; a
  clean process exit is not claimed for those runs.

See [plugin test instructions](../../../plugin/tests/README.md) for the committed
mixed-ID fixture and repeatable smoke extension.

Pending: GUI undo/redo, visual readability and linked excerpt/all-parts checks.
Milestone/task remains in progress pending human review and manual validation.

## Context

[Milestone](PLAN.md), [version comparison and Eb-tuba investigation](COMPARISON.md).
Prior local experiments disagree on Eb-tuba offsets; saved fingerings are not
an independent correctness oracle. Confirm runtime semantics before replacing them.
