# MuseScore plugin

Status: in-progress

Reconcile local formatter variants with the packaged repository plugin while
preserving recent repository improvements. Plan approved 2026-11-09.

## Scope and decisions

- `plugin/` is canonical: `scripts/packaging/packagePlugin.sh` packages it.
- Import `sousaphone` and `bb-sousaphone` fingering aliases from the installed copy.
- Restore the optional debug-log checkbox and collect window logs only when enabled,
  from `caderninhoFormatter-next.qml`. Console logging remains available.
- Keep one-char fingerings available, off by default (explicit user decision).
- Preserve dynamic trombone selection, tie-continuation handling, translations,
  modular libraries, and current Eb-tuba behavior.
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
- Verify Eb-tuba output against musician-approved notes in concert/transposed views.

## Unresolved

- Eb-tuba expected mapping and MuseScore runtime pitch semantics require manual verification.
