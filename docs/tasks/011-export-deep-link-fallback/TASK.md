---
title: Exporter deep-link fallback — paste the export link manually
status: in-progress
type: feature
milestone: collab-flow
---

# 011 — Exporter deep-link fallback

## Objective

Opening the exporter directly after login explains how to launch uploads from
cadern.in and accepts a pasted export link to enter the existing contextual flow.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Depends on [010](../010-contextual-exporter-uploads/TASK.md).
Stacked on `workstream/c-routes-review-uploads-010`.

## Approved decisions

- Keep `cadernin-export://upload?projectId=…&…` and the existing builder/parser.
  User dropped the proposed base64 change; no codec migration needed.
- Replace authenticated `NoContext` with explanation, paste input and Continuar.
  Login and email-verification gates remain first.
- Teach right-click → “Copiar endereço do link” on the website's existing
  “Enviar partitura” / “Enviar nova versão” anchors; no website UI changes.
- Parse trimmed input with `parseExportDeepLink`; invalid links stay on the
  form with a pt-BR error. Valid links set the same in-memory context as
  protocol launches. No pasted link is persisted.
- Existing live auth, membership and revision validation still runs before
  uploads and songbook re-pins. Protocol events can replace pasted context.

## Requirements

- Empty input disables Continuar; Enter or button submits nonempty input.
- Invalid protocol, malformed URL or missing projectId shows an accessible
  error; editing clears it and allows retry.
- Valid project-only and songbook-scoped links enter the existing upload flow.
- Direct launches remain scoped; no destination picker or unscoped upload.

## Approved implementation plan

User approved the revised plan and [mockup](mockup-v1.html).

1. Update task and mockup to the existing URL format.
2. Add authenticated paste form using the shared parser.
3. Feed parsed context into the existing upload flow.
4. Verify parser, form behavior, typecheck and exporter build.

## Validation

- `npx tsc --noEmit` — passed.
- Targeted ESLint — passed.
- Existing deep-link and export/upload suites — 13/13 passed using demo
  emulator configuration.
- `npm run export-app:build` with demo emulator configuration — passed;
  Vite reports its large-chunk advisory.
- Temporary Playwright component harness — passed empty/whitespace disabling,
  malformed URL, wrong protocol, missing project, error clearing, retry,
  Enter submission, project/full-context callbacks and logout.
- `git diff --check` — passed.

Browser checks exercised the paste form in isolation. Live authenticated
upload/stale-permission flows and packaged cold/warm protocol launches were
not exercised; their existing validation pipeline is unchanged.

Merged to `main` in [PR #442](https://github.com/soprodecarnaval/cadern.in/pull/442)
(`7c3d6589`). Task acceptance is not recorded here.

## Screenshots

Captured from the implemented React form with production exporter CSS in an
isolated browser harness; not an authenticated Electron session.

- [Direct launch](screenshots/01-direct-launch.png)
- [Invalid link](screenshots/02-invalid-link.png)
- [Valid link ready to continue](screenshots/03-valid-link.png)

## Unresolved questions

None.
