# Minimal browser example

From the repository root:

```sh
npm run browser-score:example
```

Open http://127.0.0.1:8080/example/index.html and select an MSCX or MSCZ file
(for instance `test-scores/all-instruments.mscz`). Use PORT to select another
local port. Stop the server with Ctrl+C.

The command copies the engine assets into `public/browser-score/`, bundles
`src/lib/browserScore` with esbuild (rebuilt on every reload) and serves this
example on loopback through `scripts/browserScore/example.mjs`. Score processing takes place in the browser worker;
the server only serves static files.

The example shows a clear success/failure message, file name, size, format and
file version. It separates passed import checks from validation limits, with raw
JSON available under Technical import details. Compatibility notices are
explained as limitations rather than detected file errors. Close score
disposes the runtime. Selecting another file closes the previous runtime first.
Invalid files show an error and can be retried.

The MusicXML section exports the full score as one MusicXML file with every
instrument part. It shows a table of the parts (MusicXML id, name, instrument,
transposition and the matching saved or prepared part), explains the warnings,
and offers the file for download. For files with saved parts the MusicXML is
built from the full score, so part-only layout is not included. Files with
MuseScore 4.1+ key signatures show a notice that they were converted for the
engine.

The parts section lists existing excerpts and can explicitly prepare instrument
parts when none exist, including potentially hidden instruments. Select all,
clear the selection, or choose individual parts, then render. Each page has its
part name, physical dimensions, SVG download and preview dialog. A successful
batch offers a ZIP containing those individual SVG files. A failed batch retains
its completed page links and reports partial output without offering a ZIP.

Part pages are drawn by Verovio from the full-score MusicXML, so files with
saved parts (such as the production scores) render too. Returned pages are
self-contained: text uses fonts embedded in the SVG and supported images must
be embedded PNG/JPEG; unresolved resources reject export. This does not establish
whether the native importer substituted a font or lost source content. Desktop
MuseScore 4.5.2 comparison failed, including a different page count for the
expanded trombone fixture. The example states this limitation. Editing is not
available yet. Unverified imports are explicitly enabled for evaluation; strict
compatibility remains the library default.

The page loads the library from `/browser.js` and the engine from
`/browser-score/`, the same paths the app serves from `public/`.
AI assistance: Codex. See the package's contribution and licensing notes.

Preparation may include hidden instruments and displays a warning when visibility is hidden or indeterminate; refresh remains available after an error.
