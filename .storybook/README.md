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
