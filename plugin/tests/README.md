# Plugin checks

Run library and formatter-traversal regressions without MuseScore:

```sh
node --test plugin/tests/*.test.mjs
```

## MuseScore smoke test

`test-scores/tuba-notation.mscz` was generated with MuseScore 4.7.5's native
instrument APIs. It contains concert and treble Bb/Eb tuba definitions,
unspecified `tuba`, both sousaphone treble/concert definitions, the deferred
`bb-sousaphone` bass definition, and an unaffected euphonium control. The first
two parts retain the chromatic passage from `tuba-eb.mscz`; added parts contain
sounding Bb1 and Eb2 reference notes.

Copy the entire `plugin/` tree into a uniquely named temporary directory inside
MuseScore's configured Plugins directory. Keep `tests/` beside the copied main
QML so the relative component import works. Run the temporary test extension:

```sh
mscore --extension 'musescore://extensions/v1/<temporary-folder>/tests/tubanotationsmoke.qml?action=main' \
  -o /tmp/tuba-notation-result.mscz plugin/test-scores/tuba-notation.mscz
```

Use the lowercase temporary folder name in the URI. On macOS the executable is
`/Applications/MuseScore 4.app/Contents/MacOS/mscore`.

The test loads the actual formatter, applies style twice, switches concert-pitch
display, and adds fingerings. It compares note pitch, concert spelling, start
tick and tie-continuation status, plus repeated clef output. Inspect the saved
score's `caderninSmoke` metadata: `OK` means these assertions passed; `ERROR ...`
records a failure. Inspect per-ID clefs and fingering output as well. Always use
a disposable output path and remove the temporary plugin copy afterward.

In this environment MuseScore sometimes crashes during CLI shutdown even after
successfully exporting a score. Check the assertions in the exported artifact;
do not treat its exit status alone as proof of plugin success or failure.

GUI undo/redo, linked excerpts/all-parts formatting and visual readability still
need manual verification. Tests and fixtures are excluded from release ZIPs by
the existing packaging script.
