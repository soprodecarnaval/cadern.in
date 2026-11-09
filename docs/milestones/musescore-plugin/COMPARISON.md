# Version comparison

Reviewed 2026-11-08; implementation approved 2026-11-09.
Local paths below are relative to `~/Documents/MuseScore4/Plugins/`.

## Inventory

| Source | Version | Findings / disposition |
| --- | --- | --- |
| `caderninhoFormatter-MU4.qml` | 3.0 | Monolithic predecessor; manual instrument selection, hard-coded Desktop log path, older pitch tables. Preserve as reference only. |
| `caderninhoFormatter-next.qml` | 3.2.1 | Monolithic automatic instrument routing, translations and debug checkbox. Import checkbox and conditional log buffering; most other behavior already present in repo. |
| `caderninhoFormatter/caderninhoFormatter.qml` | 3.3.0 | Modular installed copy; one-char/debug enabled by default, abandoned ExportWindow wiring. Defaults and exporter excluded. |
| Repo `plugins/caderninhoFormatter.qml` | 3.3.0 | Historical modular copy. Not the packaging source; leave unchanged. |
| Repo `plugin/caderninhoFormatter.qml` | 3.3.2 | Packaging source; newer dynamic trombone and tie handling. Reconciliation target. |

## Installed supporting files

- `fingerings.js`: existing tables match canonical repo; local `griff_midi`
  returns raw MIDI numbers. Repo additionally has dynamic trombone positions/picker.
  Exclude MIDI debugging and preserve repo picker.
- `musescoreInstruments.js`: adds `sousaphone` and `bb-sousaphone` aliases;
  import into the Bb-tuba branch. Local generic tuba routing drops Eb-name detection;
  preserve repo detection. Local `bass-eb-tuba` uses MIDI debug output with `-3`
  and contains unreachable code; do not copy.
- `translations.js`: repo additionally has dynamic trombone labels/tooltips;
  debug labels already exist. No translation import needed.
- `caderninInstruments.js` and `fileUtils.js`: byte-identical to canonical repo.
- `ExportWindow.qml`: local export/metadata UI and QProcess/XHR file writing.
  Excluded: [export-app plan](../export-app/PLAN.md) records why this approach was
  abandoned and replaced by Electron. No export UI is restored.

## Eb-tuba investigation

Variants conflict: `next` and historical repo `plugins/` use `-3` for
`bass-eb-tuba`; canonical `plugin/` uses `-12`; installed copy uses raw MIDI
debugging with `-3`. File dates/version numbers alone cannot resolve correctness.

Inspected `plugin/test-scores/tuba-eb.mscz` XML (MuseScore 4.7.2):

- Staff 1: `bass-eb-tuba`, bass clef, instrumentId `brass.tuba.bass`, no explicit
  chromatic transposition; pitches 24–72. Saved fingerings begin at pitch 42
  (`123`), pitch 43 (`13`), pitch 48 (`0`). These match the current tuba table
  with `-12` and may simply reflect a prior plugin run.
- Staff 2: `eb-tuba-treble`, instrumentId `brass.tuba`, chromatic transposition
  `-21`, pitches 24–72, hidden, no saved fingerings.

This is evidence of saved output, not an independent correctness oracle. It
does not establish which ID/pitch MuseScore exposes to the QML API in each view.
Retain current behavior pending runtime checks and musician-approved expectations.

## Verification record

2026-11-09: `node --test plugin/tests/fingerings.test.mjs` passed all four tests;
`git diff --check` passed. MuseScore GUI validation has not been run.

Focused Node tests cover both sousaphone aliases across MIDI 0–127, both fingering
formats, multiline valve labels, independent dynamic trombone state and unknown IDs.
QML controls, tied-note traversal and actual layout require the manual checks in
[PLAN.md](PLAN.md). No local plugin files are modified.
