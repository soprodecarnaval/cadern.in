# PDF to MusicXML research

Research snapshot from 2026-11-26. Goal is to turn sheet-music PDFs into editable scores in cadern.in, preferably with recognition performed on the user's device.

**Test Sheetscan before porting Audiveris.** Sheetscan already provides a client-side PDF-to-MusicXML pipeline. Keep Audiveris as a recognition baseline. Compare drafts by how long they take to correct before selecting an engine.

## Fit with cadern.in

The [browser score engine](../src/lib/browserScore/types.ts) accepts `.mscx` and `.mscz` and exports MusicXML. The [/enviar flow](../src/tsx/screens/upload/useEnviarFlow.ts) checks those input formats. The [upload renderer](../src/lib/scoreRender/renderForUpload.ts) generates previews and other score assets and stores an `.mscz` for each revision. The [existing WebAssembly worker setup](../src/lib/browserScore/index.ts) is a model for lazy loading and isolating recognition.

A standalone MusicXML download can ship independently. For an integrated draft, convert the recognized MusicXML to a MuseScore file, then reuse part selection, formatting, preview and save in `/enviar`. A fully client-side version needs a browser-capable bridge. Check whether the MuseScore WebAssembly build can include its MusicXML importer and save an accepted format. The desktop MuseScore conversion attempt in this environment stopped at Qt display initialization, so the bridge remains unverified.

## Audiveris baseline

Audiveris recognizes printed music and exports MusicXML from its batch CLI. It defaults to compressed `.mxl`. A book can produce multiple exports if it contains separate movements. Use a selected page range initially. The [2026 trumpet songbook](../public/2026/cadernin_2026_trompete.pdf) has 253 pages and includes front matter and title-only pages. [Batch CLI](https://audiveris.github.io/audiveris/_pages/guides/advanced/cli/) · [Export behavior](https://github.com/Audiveris/audiveris/wiki/CLI-Arguments/c02022327c62301f4bd1ceb33dfdbe05765a5203)

Local smoke test with installed Audiveris **5.9.0** on Linux:

- Page 15, “Abre Alas,” produced a parseable `.mxl` in **9.04 seconds** at about **590 MiB peak RSS**. Recognition logged missing clefs and a measure-duration warning. Musical accuracy was not checked against the original. No Tesseract language data was installed, so text recognition was not evaluated.
- Non-score pages 9 and 18 produced no MusicXML despite successful process exit. Check for a parseable score artifact and surface diagnostic messages.
- This native run is a single-page baseline. Browser memory and latency remain unmeasured.

Example using a one-page PDF and the installed Linux launcher:

```bash
JAVA_TOOL_OPTIONS=-Djava.awt.headless=true \
  /opt/audiveris/bin/Audiveris -batch -export -output ./out -- ./page-15.pdf
```

If server-side recognition is acceptable, use a containerized background worker with a page limit, per-job working directory, timeout and artifact validation. Return MusicXML or convert it to `.mscz` and open it as a draft for review. A public release adds retries, cleanup, resource limits, page and movement selection, and actionable conversion errors. Audiveris is AGPL-3.0. Review the license for the chosen packaging and deployment. [Audiveris handbook](https://github.com/Audiveris/audiveris/blob/master/docs/_pages/handbook.md)

| Scope | Rough one-engineer estimate |
| --- | --- |
| Internal batch PDF-to-MusicXML tool | 1–2 days |
| Web draft MVP for clean, single-piece PDFs | 1–2 weeks, assuming a working MusicXML-to-MuseScore bridge |
| Public import with broader PDF support | 3–5 weeks of engineering, with manual correction time separate |

## Running Audiveris in the browser

CheerpJ is one route for testing the Java batch entry point in the browser. The local Audiveris source checkout targets Java 25, which CheerpJ 5.0 offers in preview. Pin the Audiveris and runtime versions, load on demand, and pass a selected PDF through the virtual filesystem. Start with Audiveris's PDFBox rendering path. Verify worker support before relying on off-main-thread execution. [CheerpJ 5.0](https://cheerpj.com/cheerpj-5-0-released/) · [Runtime compatibility](https://cheerpj.com/docs/overview)

The main dependency risk is Audiveris's JavaCPP bindings for native Tesseract and Leptonica. Desktop binaries require a browser-compatible replacement. For the first spike, disable text OCR and bypass startup native calls as needed. Evaluate lyrics and textual markings separately. Budget **3–5 engineering days** for a go/no-go test that produces a comparable downloadable `.mxl` locally in desktop Chrome. Check that input bytes stay on-device and measure startup, conversion time, memory and cancellation before attempting multi-page or mobile support.

## Alternatives

| Candidate | What to evaluate |
| --- | --- |
| Sheetscan and homr | Sheetscan renders PDFs with PDF.js, runs homr in Pyodide with ONNX Runtime Web, and uses Verovio for display and playback. It exports MusicXML and reports an initial model download of about **150 MB**. Test cold and warm loads, mobile memory, and correction UX. Both projects are AGPL-3.0. [Live demo](https://dsalex1.github.io/sheetscan/) · [Sheetscan source and benchmark](https://github.com/dsalex1/sheetscan) · [homr](https://github.com/liebharc/homr) |
| Oemer | Independent Python recognizer that takes page images and writes MusicXML. Compare output on representative charts before evaluating a browser port. [Oemer](https://github.com/BreezeWhite/oemer) |
| Soundslice or PlayScore 2 | Commercial baselines for manual accuracy comparisons. Both export MusicXML. Soundslice's public API excludes scanning PDFs and images. [Soundslice scanner](https://www.soundslice.com/sheet-music-scanner/) · [Soundslice API](https://www.soundslice.com/help/data-api/) · [PlayScore 2 export](https://www.playscore.co/blog/faq-items/can-i-create-musicxml-files-from-sheet-music/) |

## Building a recognizer with OpenCV

OpenCV can handle thresholding, deskewing, staff-line detection and finding candidate symbols. The score reconstruction still needs symbol classification and rules for staff and part grouping, clefs, accidentals, stems, beams, flags, rests, dots, tuplets, measure boundaries and repeats. Layout changes and music with overlapping voices widen the problem substantially. Where original MuseScore scores exist, export MusicXML directly. For PDFs from a consistent engraver, inspect vector paths and glyph positions as another source of recognition data. The musical structure still needs reconstruction. [Understanding Optical Music Recognition](https://alexanderpacha.com/wp-content/uploads/2020/11/understanding-optical-music-recognition-final.pdf)

- **2–4 weeks** for a prototype on clean, consistently engraved, single-staff melodies with limited notation.
- **2–4 months** for a usable importer for a defined repertoire, assuming matching source scores for evaluation and a review flow for uncertain measures.
- **Many months or more** for general-purpose support across scans, photos, piano, multiple voices and ensemble scores.

## Evaluation plan

Spend **1–2 days** comparing Sheetscan and Audiveris on **10–20 pages**. Begin with “Abre Alas” and include trumpet and tuba parts, repeats, tuplets, a scan, and a multi-staff example if in scope. Use the original score as ground truth where possible. Record pitch and rhythm errors, missing or extra measures, key signatures, repeats and part grouping. Check written pitch and transposition for brass parts. Measure correction time, conversion time, initial model download, peak memory and mobile responsiveness.

Use the results to choose between adapting Sheetscan, applying targeted corrections to recurring errors, and pursuing the Audiveris browser spike. Verify MusicXML-to-MuseScore conversion separately before estimating the end-to-end upload feature.
