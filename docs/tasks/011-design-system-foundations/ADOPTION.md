# Adoption checklist

Reference approved by user; shared foundations and home/auth adoption authorized.
Further batches require affected screen/wireframe review per TASK.md step 6.

| Batch | Surfaces | State |
|---|---|---|
| Foundations | Tokens, buttons, fields, modal; Storybook reference | Implemented; focused checks pass |
| Home/auth | Landing page, login/register/reset/verification/Google-link dialogs | Implemented; focused checks pass |
| 1 — navigation/projects | AppNavigation, AuthButton, project list/create/public/settings, CreateSongbookForm, NotFoundPage | Implemented; 43 relevant stories pass |
| 2 — builder/dialogs | HomePage, search/results/cards, SongBookTable/sortable rows, save, PDF selection, metadata/score edit, detail and profile dialogs | Awaiting screen review |
| 3 — songbook/review | Public/member songbook pages, scoped score page, generation/cover modal, score page/revisions/lineage, comments, reader/part controls | Awaiting screen review |
| 4 — exporter | App shell, LoginForm, file/parts/metadata/upload/progress, contextual launch states | Awaiting screen review; validate actual Electron UI |

Batch review uses existing screen stories with proposed design-system treatment,
including mobile/desktop, empty/loading/error and permission states. Preserve
layout and behavior. Generated PDFs/static documents are excluded. No UI
exceptions approved. These groups cover route screens and their shared views;
reconcile detailed component inventory before closing task 011.

## Shared API

- `Button`: native button props/ref; `variant="primary" | "secondary" | "text" | "danger" | "danger-secondary"`; default `type="button"`, use `type="submit"` for form actions. Native `disabled` and `aria-busy` remain available; loading copy/spinner belongs to caller.
- `Input`: native input props/ref; label via `htmlFor` or accessible name; caller sets `aria-invalid`, `aria-describedby` and feedback. Preserves controlled/uncontrolled usage.
- `Modal`: React Bootstrap Modal props with branded surface; `.Header`, `.Title`, `.Body`, `.Footer` reuse Bootstrap primitives. Retains focus trap, Escape and restoration behavior.
- Navigation links remain anchors/router links, using shared tokens/classes as appropriate. Do not turn navigation into button callbacks.
- `src/styles/tokens.css`: shared `--ds-*` palette, type, spacing, border, radius and focus values. Existing `brand-modal` and landing aliases bridge older components during adoption.

Batch 1 wireframe: `Design System/Reference → Project Batch` (`design-system-reference--project-batch`). Illustrative navigation, list, create, project and settings forms; no writes. Await user review before migrating those production screens.

Batch 1 approved and implemented: shared page shell and branded navigation,
project card/link/action styles, fields/selects, project creation and settings,
new-songbook form and not-found page. Navigation actions use actual links;
destructive actions retain red styling. Permission and operation handlers are
unchanged. Relevant story checks: 43/43 pass against static Storybook; mobile
checks cover navigation/create/public/settings. App/Storybook builds, story
TypeScript and targeted ESLint pass.

Batch 2 review: `Design System/Builder batch → Builder` and `Dialogs`.
Builder is the existing fixture-driven screen with a story-only branded scope;
dialog examples illustrate the shared surface for save/PDF/metadata actions.
Production builder/dialog components await approval. Existing screen stories
retain detailed operation/role/error-state coverage for subsequent migration.

User approved builder/dialog previews. Batch 2 is authorized for implementation. Shared components use unprefixed names: `Button`, `Input`, `Modal`, `Link`, `Page`; third-party imports use aliases when needed.

## Folder and stylesheet ownership

User approved `src/tsx/atoms`, `components` and `screens`. Atom exports are split
into Button/Input/Link/Modal/Page files with adjacent styles. Shared domain UI
lives in components; screen-only views/dialogs/forms live under their screen.
Existing component names and story IDs are retained. App.tsx remains the app
composition/router entry. Exporter-specific UI retains src/export-app for now.

Global styles and tokens live in src/styles. Navigation and profile styles were
split from the old aggregate stylesheets; feature CSS follows its owning UI.
Shared Storybook fixtures and cross-screen reference stories live in .storybook.
Source imports, CSS asset URLs, main entry and recursive story discovery were
updated together. No screen behavior or route names are changed by this move.
