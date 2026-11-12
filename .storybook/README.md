# Component gallery

- `npm run storybook`: development gallery at http://localhost:6006.
- `npm run build-storybook`: static output in `storybook-static/` (ignored).
- `npm run typecheck:storybook`: configuration and story type checks.

Storybook uses its own Vite configuration, without app environment files,
Firebase credentials, emulators, or audio initialization. Production components
retain their connected wrappers; stories import the corresponding `*View` and
inject fixture data and callbacks through props. PaginationBar is already pure.

Add stories beside components in `src/tsx/*.stories.tsx`, using typed CSF metadata
and a stable `Components/Name` title. Shared sample data lives in
`src/tsx/storyFixtures.ts`. Do not import connected wrappers into stories.

Auth stories use play functions to reach registration/error/reset states on
navigation. ResetPending intentionally leaves its fixture promise pending.
Callbacks are spies; no authentication or audio occurs. ScoreCard shows static
instrument pills and fixture lineage; its eye button calls an injected spy.
The connected app opens ScoreDetailModal. PartItem previews the instrument pill.
Click the auth modal’s close button, then “Abrir conta” to reopen.

Static story URLs use `iframe.html?id=components-scorecard--expanded` (and the
IDs in `index.json`). Serve the output over HTTP; opening files directly is
unsupported. Check browser rendering, play functions, console, and network;
a successful build alone does not validate interactions.

## Screen coverage

Screen stories cover home/library/builder, my scores, score review, my projects,
project creation/public/settings/songbooks, songbook details/editor, navigation,
and not-found. Profile, save, quick-score detail, metadata editing, builder score
editing, and PDF selection/progress have dialog stories. Navigation is a separate
story group; page stories show route content without duplicating the header.

Connected screens inject typed operation props and UI composition. Their views
retain form, loading, and interaction state. Collection/search and card renderers
are passed through the builder tree; real connected wrappers still supply those
props in production. Shared screen data and local renderers live in
`src/tsx/screenFixtures.tsx`. The fixture Timestamp/User values support the
methods used by production views. Operations simulate outcomes without persisting
backend data. MIDI/audio and PDF generation are simulated.

Stories can set `parameters.route` and `parameters.routePath` for route params
and query strings. Navigation stays inside MemoryRouter and displays the target
URL for routes outside that story. Dialog stories support close/reopen. Use play
functions with visibility waits to reach modal/tab/error states after transitions.

The Electron export app is excluded. The songbook reader has its own stories
(`Components/SongbookReader`, fixtures in `storyFixtures.ts`); they open a score
with `parameters.route` (`/?musica=<number>`). Songbook page stories start at
`?detalhes`, and their injected reader fixture stands in for the reader there.

## Repeatable browser checks

Install Chromium once with `npx playwright install chromium`. Start Storybook,
then run `npm run test:storybook`. Override the URL when needed:

```sh
STORYBOOK_URL=http://127.0.0.1:6008 npm run test:storybook
```

The same command works against an HTTP-served `storybook-static/` build. It
checks every indexed story and waits for render/play completion, capturing browser
errors. It blocks and fails external HTTP requests, detects AudioContext creation,
and verifies stories leave the homepage builder's saved storage untouched.
