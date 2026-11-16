---
title: Exporter deep-link fallback — paste the export link manually
status: open
type: feature
milestone: collab-flow
---

# 011 — Exporter deep-link fallback: paste the export link manually

## Objective

Opening the exporter directly (no `cadernin-export://` deep link) no longer
dead-ends after login: the authenticated area explains that uploads launch
from the cadern.in website and accepts the export deep link pasted by hand,
falling back to the same contextual upload flow as a protocol launch.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: small–medium. Dependencies: 010 (deep-link protocol, context
validation, `NoContext` screen this task replaces). Stacked on
`workstream/c-routes-review-uploads-010`.

## Decisions (proposed — pending wireframe approval)

- **Link format becomes `cadernin-export://$BASE64_ENCODED_DATA`**: the
  payload (same fields as 010 — `projectId` always; `scoreId` +
  `expectedScoreRevisionId` optionally; `songbookId` +
  `expectedSongbookRevisionId` optionally) is serialized as JSON and encoded
  as URL-safe, unpadded base64 (RFC 4648 §5, `-` and `_`, no `=`). The whole
  link is one opaque token — no query string. *Why not standard base64: `/`
  terminates a URL's authority and starts the path, `+` is percent-mangled,
  and `=` padding is brittle across hand-copy contexts (chat apps, email
  line wraps). URL-safe base64 avoids all three; `new URL()` keeps parsing
  the token as a single host segment.*
  Example: `cadernin-export://eyJwcm9qZWN0SWQiOiJzdXJkby1lLWNpYSJ9` decodes
  to `{"projectId":"surdo-e-cia"}`.
- **No backward compatibility with the 010 query-string format.** Collab
  flow has never deployed (`FEATURE_FLAG_COLLAB_FLOW` default `false`), the
  packaged exporter isn't released, and old links die with the page that
  built them — they're generated fresh on every page view. Parse accepts
  the new format only and rejects everything else.
- **The paste box is the only new UI, on the authenticated area only.** It
  replaces 010's blocking `NoContext` dead end: same card pattern, same
  explanation ("abra a partir da página de um projeto ou de uma partitura
  em um caderninho no site"), plus a text input and a "Continuar" button.
  Unauthenticated users still see the login gate first — there is nothing
  to paste an export link into before signing in.
- **Pasted input gets zero trust, same as a protocol launch.** The pasted
  string is parsed with the same `parseExportDeepLink` used by the Electron
  main, then flows through the exact same pipeline: `validateExportContext`
  revalidates auth, editor membership and expected revisions against live
  data when the panel resolves the context, right before the upload starts,
  and once more right before any songbook re-pin. Tampered, truncated or
  half-crafted base64 fails closed with a pt-BR message pointing back to
  the website.
- **Write-paste-store, not read-paste-store**: pasting only resolves the
  destination in memory (same as a warm `second-instance` launch); it is
  never written to disk, and a later real deep-link launch replaces it.
- **The website needs no new copy affordance for v1.** Both launch buttons
  ("Enviar partitura" on the project page, "Enviar nova versão" on the
  songbook-scoped score page) are plain anchors carrying the deep link as
  `href` — right-click → "Copiar endereço do link" already yields the full
  link. The fallback screen's explanation teaches that gesture. An explicit
  "Copiar link" button can be added later if users don't find it.

## Requirements

- Opening the exporter directly while authenticated shows an explanation
  (uploads start on the cadern.in website) and a text input for pasting a
  `cadernin-export://` link; the flow proceeds only from a valid link —
  there is still no path to an unscoped upload.
- `buildExportDeepLink` emits `cadernin-export://<base64url of JSON>`;
  `parseExportDeepLink` decodes and validates it (must carry `projectId`);
  malformed, truncated or wrong-protocol pastes fail with a clear pt-BR
  message and stay on the input screen.
- All identifiers carried by any link — protocol or pasted — remain
  untrusted and revalidated against live data before any write.
- Protocol launches keep working unchanged (cold argv, warm
  `second-instance`/`open-url`): the paste input is strictly additive.
- Unit-test the codec: round-trips for every context shape, rejection of
  garbage/standard-base64-with-`+`/wrong-protocol/missing-`projectId`,
  padding tolerance where safe.

## Implementation plan

1. Wireframes iterated and approved: [mockup-v1.html](mockup-v1.html) —
   link source on the website, the three fallback-screen states, and
   hand-off into the existing contextual flow.
2. Codec: base64url encode/decode helpers + `buildExportDeepLink`/
   `parseExportDeepLink` in `types/exportDeepLink.ts`; update
   `findExportDeepLinkArg` if the prefix form needs it (it does not — the
   prefix is unchanged).
3. Fallback UI: evolve `NoContext` (`src/export-app/App.tsx`) into the
   explanation + paste screen; on valid parse, set the same context state
   a protocol launch sets.
4. Tests: extend `types/exportDeepLink.test.ts`; a component test for the
   paste screen states if a harness exists for the export app.

## Validation

Paste a good link copied from the site's launch buttons → contextual flow
identical to a protocol launch, including stale-link and no-permission
messages. Paste garbage, truncated and standard-base64 links → clear errors,
no crash, no partial state. Open directly with no paste → explanation stays.
Cold/warm protocol launches unaffected. `tsc`, `eslint`, `vitest`,
`vite build --config vite.electron.config.ts` clean.

## Unresolved questions

None — resolved above, pending wireframe approval.
