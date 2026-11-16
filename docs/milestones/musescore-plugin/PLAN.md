# MuseScore plugin

Status: in-progress

Reconcile local formatter variants with the packaged repository plugin while
preserving recent repository improvements. Plan approved 2026-11-09.

## Scope and decisions

- Default tuba/sousaphone notation: concert note names in bass clef, written
  one octave above sounding pitch (bass clef with 8 below). Bb and Eb instruments
  share the same written part; their fingerings differ. Decision agreed with
  tuba players, 2026-11-11.
- Offer transposed treble and transposed bass clefs as optional notation modes.
- Optional written-to-sounding intervals: bass Bb -14 / Eb -9 semitones;
  treble Bb -26 / Eb -21. Instrument IDs determine tuning and target notation
  policy, including for customized parts. Apply changes using current/all-parts scope.
- `tuba` selects `concert-octave`, with the existing Bb/Eb-name tuning fallback.
  Transposed-bass notation implementation is deferred; retain existing notation
  for those IDs while implementing concert-octave and transposed-treble.
- Implement notation and fingering support through
  [000 — Tuba notation modes and tuning-aware fingerings](000-tuba-notation-and-fingerings.md).
- `plugin/` is canonical: `scripts/packaging/packagePlugin.sh` packages it.
- Import `sousaphone` and `bb-sousaphone` fingering aliases from the installed copy.
- Restore the optional debug-log checkbox and collect window logs only when enabled,
  from `caderninhoFormatter-next.qml`. Console logging remains available.
- Keep one-char fingerings available, off by default (explicit user decision).
- Preserve dynamic trombone selection, tie-continuation handling, translations
  and modular libraries. Task 000 replaces the earlier provisional Eb-tuba offset.
- Exclude the abandoned in-plugin exporter and local MIDI-debug experiment.
- Leave historical `plugins/`, installed files, release ZIPs and download links
  unchanged. Repackaging is a separate release step.

## Process

1. Inventory and compare all three local entry points and supporting libraries.
2. Record provenance, selected changes and exclusions in [COMPARISON.md](COMPARISON.md).
3. Import the selected changes into `plugin/`.
4. Run focused regression checks and inspect the Eb-tuba fixture.
5. Manually validate in MuseScore; review before milestone completion/release.

## Validation

Run `node --test plugin/tests/*.test.mjs` and `git diff --check`.
The Node harness executes QML JavaScript libraries after removing QML directives;
it does not validate MuseScore APIs or render QML.

Manual checks pending:

- Load `plugin/caderninhoFormatter.qml` in MuseScore 4; confirm both locales.
- Confirm one-char and dynamic trombone options start off and can be enabled.
- Compare Bb tuba and both sousaphone IDs with one-char on/off.
- Toggle debug logging, run formatting, disable to clear, then re-enable.
- Verify tied notes do not receive duplicate fingerings; check all-parts mode.
- Review Eb-tuba reference fingerings with musicians; automated/runtime checks
  now cover both score displays, octave clefs and playback preservation in task 000.

## Unresolved

- Missing transposed-bass/Eb-sousaphone definitions are deferred. Existing-ID
  policies, including unspecified `tuba`, are recorded and implemented in task 000.
- GUI undo/redo, linked excerpt/all-parts behavior and musician review remain.
