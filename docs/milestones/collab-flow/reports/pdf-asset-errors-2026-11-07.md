# Songbook SVG failures — regression verification, 2026-11-07

## Reproduction

`drawSvg` caught network, response-body and rendering errors, logged them, and
resolved successfully. It also passed HTTP error bodies to the SVG renderer
without checking `response.ok`. Consequently, `createSongBook` could download a
PDF with missing score pages while the UI reported success.

Regression tests against the original implementation reproduced this: eight
failure/retry cases failed because generation resolved instead of rejecting;
the delayed successful-download test passed.

## Change

- Reject non-success HTTP responses before reading/rendering their bodies.
- Propagate SVG network, body-read and renderer exceptions as `PdfAssetError`,
  identifying score, authored part name and SVG page. HTTP failures include
  their status. User-facing errors contain no asset URL or download token.
- Queue SVGs, covers and appendix images until layout has finished, then attach
  handlers to all tasks together. This avoids unhandled early rejections while
  a later score's layout awaits an image. Sponsored back-page images remain
  awaited before drawing their text, preserving visual layering.
- Download only after all queued tasks succeed. A failed instrument does not
  reach the download step. PDFs already generated for earlier instruments in a
  batch are unaffected.
- Show the contextual SVG error in the existing error dialog and allow retry.
  Other error types keep the existing generic message.

This work branches from `fix/songbook-pdf-cors` (PR #403), itself on #402.

## Validation

- Eleven focused generation tests cover network failures; HTTP 403/404/500;
  failed body reads; renderer exceptions; score/part/page context without URL
  tokens; retry; delayed successful assets; sponsored image layering; and early
  rejection after asynchronous back-page layout. Failures assert no PDF stream
  or download is created.
- All 209 unit tests passed. TypeScript, targeted lint and staging website and
  export-app builds passed. Existing protobuf/eval and bundle-size build warnings
  remain unchanged. No Firebase rules or backend handlers changed.
- Served the production website build locally at `http://127.0.0.1:4173`, using
  staging data, and tested the actual `ola-mundo/bloco-da-chuva` songbook in an
  isolated Chrome profile authenticated as its existing owner.
- Browser-intercepted network failure: contextual score/part/page error shown,
  no PDF downloaded, retry enabled, no unhandled exceptions.
- Browser-intercepted HTTP 404: status and score context shown, no PDF downloaded,
  retry enabled, no unhandled exceptions.
- Removed the interception and retried from the same modal: a 757,854-byte PDF
  with a valid PDF signature downloaded successfully, including the saved cover,
  with zero browser errors during successful generation.
- Temporary authenticated browser profile removed; local preview stopped. No
  staging application deployment or Firestore/Storage writes were performed for
  this fix.
