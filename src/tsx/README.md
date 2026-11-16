# UI organization

- `atoms/`: generic UI primitives. Import Button, Input, Link, Modal and Page directly from their files.
- `components/`: reusable application UI shared across screens, grouped by domain.
- `screens/`: routed pages and app-level account/auth dialogs, plus components unique to them. Keep connected wrappers and presentational views together.
- `App.tsx`: app composition, routes and top-level dialogs.

Production dependencies flow from screens to shared components and atoms. Atoms
must not import screens or domain components. Promote a screen-local component
when a second screen needs it; avoid creating empty abstraction folders.

Colocate component CSS and stories with their owner. Shared styles/tokens live in
`src/styles`. Cross-screen reference stories and shared test fixtures belong in
`.storybook`. Stories/fixtures may compose across layers. Exporter-specific
screens remain in `src/export-app` and can consume shared atoms/components.

File moves do not imply a visual redesign or route localization. Preserve CSF
story titles/IDs and update relative asset URLs whenever moving stylesheets.
