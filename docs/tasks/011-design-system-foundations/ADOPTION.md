# Adoption checklist

Reference approved by user; shared foundations and home/auth adoption authorized.
Further batches require affected screen/wireframe review per TASK.md step 6.

| Batch | Surfaces | State |
|---|---|---|
| Foundations | Tokens, buttons, fields, modal; Storybook reference | Implemented; focused checks pass |
| Home/auth | Landing page, login/register/reset/verification/Google-link dialogs | Implemented; focused checks pass |
| 1 — navigation/projects | AppNavigation, AuthButton, project list/create/public/settings, CreateSongbookForm, NotFoundPage | Implemented; 43 relevant stories pass |
| 2 — builder/dialogs | HomePage, search/results/cards, SongBookTable/sortable rows, save, PDF selection, metadata/score edit, detail and profile dialogs | Implemented; focused checks pass |
| 3 — songbook/review | Public/member songbook pages, scoped score page, generation/cover modal, score page/revisions/lineage, comments, reader/part controls | Implemented; 73 relevant stories pass |
| 4 — exporter | App shell, LoginForm, file/parts/metadata/upload/progress, contextual launch states | Implemented; built-render checks pass |

Batch review uses existing screen stories with proposed design-system treatment,
including mobile/desktop, empty/loading/error and permission states. Preserve
layout and behavior. Generated PDFs/static documents are excluded. No UI
exceptions approved. These groups cover route screens and their shared views;
reconcile detailed component inventory before closing task 011.

## Shared API

- `Button`: native button props/ref; `variant="primary" | "secondary" | "text" | "danger" | "danger-secondary"`; default `type="button"`, use `type="submit"` for form actions. Native `disabled` and `aria-busy` remain available; loading copy/spinner belongs to caller.
- `Input`: native input props/ref; label via `htmlFor` or accessible name; caller sets `aria-invalid`, `aria-describedby` and feedback. Preserves controlled/uncontrolled usage.
- `TextArea`: native textarea props/ref; same styling and accessibility contract as `Input`.
- `Select`: React Bootstrap `FormSelect` props/ref, preserving `Form.Group` context with shared field styling.
- `List`: React Bootstrap `ListGroup` surface with `List.Item`; shared borders and yellow active/hover states.
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

Batch 2 implemented after approval: builder shell/search/sort, score cards and
sortable actions, pagination, save/PDF/profile/score edit/detail/metadata dialogs.
Select is a typed Bootstrap-backed atom preserving Form.Group context. Hidden
file choosers and specialized drag/add affordances retain their handlers; shared
styles use tokens. Labels were associated with their inputs while adopting atoms.

Batch 3 preview: `Design System/Songbook batch`, with Public, Manage, Reader,
Review and Generation stories. Uses existing fixture-driven views with a
story-only branded wrapper and reader/select/textarea treatment. Score display
uses the existing silent fixture, not real audio initialization. Production batch
3 screens await approval; shared batch 2 controls already appear consistently
where those screens reuse them.

Batch 2 final validation: 51 relevant stories, ten responsive checks and add-score/keyboard reorder pass; builds/types/lint pass. Batch 3 preview: five stories checked at desktop/mobile. No batch 3 production-page migration yet.

Batch 3 approved with correction: remove remaining blue outlines in Reader,
Manage and Histórico. Migrated songbook pages, reader, generation/cover modal,
score page/review controls and revision histories to shared atoms. Added List
and TextArea atoms; active history and reader selection use yellow/black. Removed
story-only treatment so previews exercise production styling. Scoped-score
stories now use the existing silent display fixture to avoid audio side effects.

Batch 3 validation: 73/73 selected stories pass; computed-style checks verify
Reader/Manage borders are black and selected history is yellow with black
borders at 1280px and 390px. App/Storybook builds, story types and lint pass.

Final batch preview: `Design System/Exporter batch` — Ready, Login,
Open from website, Uploading and Failure. Uses atoms and fictitious data only;
no Electron preload, file export, auth or upload side effects. Actual exporter
migration and runtime checks await approval of this treatment.

Exporter preview validation: 10/10 checks pass at 1280px and 390px (five
stories each), including login fields, no-context message, upload-disabled
controls, simulated progress and failure alert. No console errors or horizontal
overflow. Storybook typecheck and whitespace checks pass. Production exporter
migration awaits approval.

Batch 4 implemented after approval: exporter entry loads Bootstrap, Inter and
shared tokens; App shell, login/verification/no-context states, metadata form,
part selection and upload panel use atoms. Exporter styles use black/yellow
tokens, with no blue accents. FileDrop gained keyboard activation; part
checkboxes gained accessible names. Errors use shared alert styling. The
Electron binary is unavailable in this checkout, so the built renderer was
served in Chromium with a stubbed preload: login screen, fields, enabled/
disabled buttons and focus outlines verified. `export-app:build`, app
typecheck and exporter lint pass.

## Storybook organization

Storybook now uses three flat sections: `Atoms/Name`, `Components/Name` and
`Screens/Name`, with no intermediate folder levels. The design-system reference
moved to `Atoms/Reference` (`atoms-reference--overview`) with its stylesheet
beside the atoms. The approved batch preview stories were removed; production
screens now carry the design-system treatment. The exporter remains outside
`src/tsx` and has no stories yet; task 013 covers presentational extraction and
coverage.
