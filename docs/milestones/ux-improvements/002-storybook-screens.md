# 002 — Storybook screens

Status: in-progress

## Goal

Extend the prop-driven gallery to all web routes and their principal dialogs,
using real production views with local data and injected operations. Exclude
SongbookReader and the Electron export app. No Firebase/emulators, remote media,
audio initialization, real downloads, or writes from stories.

## Approved plan

1. Base feat/storybook-screens on merged main.
2. Retain connected wrappers; extract service-free screen/widget views. Inject
   data, async operations, user/role state, and composition through typed props.
   Keep existing application import paths, routing, and behavior.
3. Cover home/library/builder, my scores, score detail/review, my projects,
   project creation/public/settings/songbooks, songbook details/editor,
   navigation, profile/save/edit dialogs, and not-found.
4. Add existing loading, empty, populated, permission, and error states where
   meaningful. Include direct story URLs, local assets, stable titles, and
   reproducible interactions. Do not invent unsupported error UI.
5. Check rendered browser stories and interactions, console/network isolation,
   types, targeted lint, unit tests, Storybook build, and demo-config app build.

## Boundaries

- Do not edit SongbookReader. Songbook stories open details/editor mode.
- Extend the established prop injection approach; no new shared data layer or
  Storybook module aliases/mocks. Group related operation props where useful.
- Include role/feature variants of the app's actual UI. Connected children must
  be isolated too; use their real views rather than placeholder screen replicas.
- Keep task in-progress pending human completion approval. No staging/push.

## Coverage and validation

Implemented coverage (including the original 20 pilot stories):

| Area | Stories |
| --- | ---: |
| Navigation | 4 |
| Home/library/builder | 8 |
| My scores | 5 |
| Score detail/review | 10 |
| My projects | 5 |
| Create project | 6 |
| Public project | 6 |
| Project settings | 8 |
| Project songbooks | 6 |
| Songbook details/editor | 12 |
| Not found | 1 |
| Profile dialog | 8 |
| Save songbook dialog | 4 |
| Quick score detail dialog | 3 |
| Score metadata dialog | 4 |
| Builder score edit dialog | 2 |
| PDF selection/progress | 4 |
| Original pilot components | 19 |
| Total | 115 |

Architecture: connected wrappers provide user/role, existing DB operations, storage,
audio/PDF operations, and connected child renderers. Views retain existing state
and handlers. Shared builders receive card renderers through props. No runtime
Firebase/app/audio imports in the gallery's view graph; fixture Timestamp comes
from the SDK without initializing the app. No Storybook aliases or data-layer
abstraction added. The existing reader file is unchanged.

A browser check is available as `npm run test:storybook` (set `STORYBOOK_URL`
for other ports/static servers). Play functions cover forms and error states,
revision expansion, metadata editing, PDF progress, comment picking, and adding
an available score to the songbook editor. Dialog harnesses allow close/reopen.

Browser checks exposed pre-existing invalid HTML: a div-based spinner inside a
paragraph in project cards. The extracted view uses a div container with the
same classes; no visual redesign or unrelated behavior change.

Validation (2026-11-11):

- `npm run typecheck:storybook` and `npx tsc --noEmit`: pass.
- Targeted ESLint across changed/new TypeScript and Storybook config: pass,
  no warnings. `node --check scripts/storybook/checkStories.mjs`: pass.
- `VITE_USE_EMULATORS=true npm test -- --run`: 34 files / 237 tests pass.
- `VITE_USE_EMULATORS=true npm run build`: pass; real Firebase environment
  remains unavailable. Existing bundle-size and demo-title warnings remain.
- `npm run build-storybook`: pass without app credentials/emulators.
- Browser check after rebasing onto current `origin/main`: 115/115 stories
  pass, including the editor-addition case and all play assertions.
- Browser checks report no console errors, external HTTP requests, audio
  initialization, or writes to the saved home builder.
- Inspected screenshots of home, score review, settings, and songbook editor.
- `git diff --check`: pass. `SongbookReader.tsx` has no diff.

The task stays in-progress pending human completion approval. Nothing staged,
committed, or pushed.

Unresolved questions: none.
