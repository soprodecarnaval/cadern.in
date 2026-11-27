# Browser score upload — Plan

Contributors edit in MuseScore and upload the `.mscz` as saved. The
caderninho formatting the caderninhoFormatter plugin did in MuseScore
happens in the browser, and the songbook PDF is built from the browser's
SVGs. The export app and the plugin retire once maintainers sign off.

## Pieces

| Piece | Where |
| --- | --- |
| Engine (webmscore + Verovio in a worker), parts, MIDI, shared fonts | `src/lib/browserScore`, `scripts/browserScore/assets.mjs` |
| Instrument table, fingering tables and notations | `src/lib/instruments` |
| Clean-up, tuba notation, piratas, formatting profile, `renderForUpload` | `src/lib/scoreRender`, `types/formattingProfile.ts` |
| Score identity on bytes | `src/lib/msczIdentity.ts` |
| Upload context, revalidation, staleness gate, re-pin | `src/lib/uploadFlow.ts`, `src/lib/uploadPath.ts` |
| Send and reformat screen `/:slug/enviar` | `src/tsx/screens/upload` |
| Songbook PDF and reader fonts | `src/createSongBook.ts`, `src/lib/sharedFonts.ts`, `src/lib/useSvgUrl.ts` |
| Re-render stored revisions | `scripts/browserScore/rerender.ts` |
| Checks | `scripts/browserScore/{partPages,midi,upload}.mjs`, `tests/e2e/browserUpload.mjs` |

## Status

Merged to `main` behind `VITE_FEATURE_FLAG_BROWSER_UPLOAD` (`off`, `beta`,
`default`). See [015 — Browser score upload](../../tasks/015-browser-score-upload/TASK.md)
for merge references, validation evidence and the outstanding rollout checklist.
Switching to `default` and retiring the plugin and export app still require sign-off.
