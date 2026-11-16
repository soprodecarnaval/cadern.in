---
title: Add Storybook coverage for the Electron exporter
status: open
type: feature
milestone: ux-improvements
---

# 013 — Exporter Storybook stories

## Objective

Cover the Electron exporter's renderer UI in Storybook without launching
Electron or connecting to Firebase, so its states can be reviewed and checked
like the website screens.

## Placement and dependencies

Milestone: [UX improvements](../../milestones/ux-improvements/PLAN.md).
Depends on [011 — Design system](../011-design-system-foundations/TASK.md) for
atoms and tokens. Independent of [012 — pt-BR routes](../012-pt-br-routes/TASK.md);
either order is acceptable. Difficulty: medium.

## Requirements

- Keep the exporter app under `src/export-app`; do not move Electron main,
  preload or IPC code into the website bundle.
- Extract presentational views where needed. Follow the existing website story
  pattern: stories import `*View` components and inject user, role, context,
  services, callbacks and operation results through typed props.
- Cover at minimum: login, Google-link password prompt, pending email
  verification, no-context paste form (empty, invalid, valid), file drop
  disabled/enabled, parts table compatible/incompatible, metadata form,
  upload-panel loading/invalid/version/fork/warnings/progress/success/failure,
  and the ready export shell.
- Do not import `useAuth`, Firebase initialization or the real preload into
  stories. Authentication callbacks and `window.api` methods are spies or
  fixture implementations; no file access, export, upload, folder opening or
  external requests may occur.
- Use a top-level `Exporter` Storybook section unless the user approves folding
  these stories into `Screens`. Keep story titles flat within the section, with
  no intermediate folder hierarchy.
- Add the exporter story glob to `.storybook/main.ts` and its paths to
  `.storybook/tsconfig.json`. Keep the three website sections (`Atoms`,
  `Components`, `Screens`) unchanged.
- Document the exporter's story API and injected dependencies in
  `.storybook/README.md`, including why Electron is excluded from the browser
  check.

## Implementation plan

1. Split the connected exporter shell and login/upload components into thin
   wrappers plus presentational views with typed props; preserve current
   behavior and IPC contracts.
2. Add story fixtures for users, export contexts, parsed parts, metadata and
   upload progress/outcomes. Keep fixture timestamps and errors local.
3. Write stories with play functions for paste validation, file selection,
   part toggling, metadata editing, progress, success and failure states.
4. Add Storybook discovery, typecheck and README documentation.
5. Validate render/play, console/network isolation, responsive widths and the
   packaged exporter build.

## Validation

- Every exporter story renders without Electron, Firebase, network or audio.
- Paste form accepts valid links and rejects malformed ones accessibly.
- Parts and metadata callbacks update rendered state; upload states cannot
  trigger real export or upload.
- Check 1280px and 390px layouts, keyboard focus and disabled states.
- Run Storybook typecheck/build and `test:storybook`; run `export-app:build` and
  exporter typecheck/lint to confirm the view extraction preserves the app.
- Verify the actual Electron UI separately when the Electron binary is
  available; browser stories do not replace packaged-app checks.

## Unresolved questions

Top-level `Exporter` section approved? Split connected views now, or mock hooks
and preload only? Which upload states are essential for the first pass?
