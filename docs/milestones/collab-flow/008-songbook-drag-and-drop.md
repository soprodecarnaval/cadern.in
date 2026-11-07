# 008 — Songbook drag-and-drop editor

Status: completed

## Goal and decisions

Replace reorder arrow buttons in the shared songbook editor with drag handles.
This applies to saved songbooks and the homepage builder. Dragging a section
moves only its header; songs remain in their existing relative order. Songs and
headers may be inserted between any rows, including before the first header or
into an empty section.

Support pointer, touch and keyboard operation, a compact drag preview, insertion
feedback, auto-scroll, and cancel/outside-drop restoring the original order.
Keep expand/edit/remove/play controls independent of dragging. The dragged song’s
details hide during dragging and return afterward; other expanded rows stay in
place. Saved songbooks retain explicit Save version/Cancel behavior; builder
persistence stays unchanged.

## Architecture and implementation plan

- `SongBookTable`: existing editor controls and controlled draft items.
- `SongbookSortableList`: dnd-kit provider, sensors, drop detection, preview and
  accessible Portuguese instructions/announcements.
- `SortableSongbookRow`: stable item identity, sortable bindings and row choice.
- Existing score/section rows: content/actions and a dedicated `DragHandle`.
- `songbookReorder`: pure remove/insert operation preserving complete items.
- `useSongbookEditorItems`: stable UI IDs, including duplicate section headings.

Keep the existing persisted item format; temporary editor IDs are never saved.
Preserve pinned revisions, deletion markers and other item metadata through
reordering. No backend, permission or schema changes.

## Validation

Test forward/backward insertion, header-only movement, canceled/invalid drops,
stable IDs, duplicate headings, and revision-pin preservation. Run relevant unit
checks, TypeScript, lint and builds. Browser-check pointer/touch/keyboard moves,
expanded state, cancellation, builder persistence and saved-songbook save/reload.

## Context

Started from updated `main` at `718685ef`. PRs #403/#404 were merged into former
stack parents and their changes were not yet on main when this feature started.
Those changes are not folded into this branch implicitly.

## Implementation and verification

Implemented on `feat/songbook-drag-and-drop`. The sortable layer uses dnd-kit
0.5.3 with its optimistic DOM reordering disabled: React owns the item order and
updates it only on a successful drop. Table row groups keep score details
attached; a line shows the insertion boundary and the overlay shows only the
item label. Pointer drops choose before/after the target's midpoint. Keyboard
moves step between entries. Invalid and outside drops do not call the parent.

The dragged score's details compact during capture, before native sensor
measurement, then return after drop/cancel. This prevents expanded content from
making keyboard moves skip neighbors. Other expanded rows stay in place.
Unchanged insertion targets do not rerender the entire list on every pointer
move. Metadata edits also preserve the existing entry wrapper and pinned fields.

Checks passed:

- 212 unit tests, including seven reorder/identity/pin regression cases.
- TypeScript and targeted lint for every changed source/test module.
- Staging website and export-app builds. Existing protobuf eval and large-bundle
  warnings remain unchanged.
- Fourteen Chrome checks using only isolated demo Firebase emulators: keyboard
  reorder with expansion/focus retained; Escape; header-only movement; duplicate
  section titles; pointer insertion; outside-drop cancellation; mobile touch;
  moving a song into an empty final section; save preserving revision pins;
  save/reload; Cancel discarding drafts; homepage order persistence; long-list
  auto-scroll; Portuguese keyboard/screen-reader instructions. No console errors.

No schema migration is required. The browser profile and local test services
were removed/stopped after verification. Implementation completed following human
review; direct staging Hosting deployment and its smoke check follow PR creation.
