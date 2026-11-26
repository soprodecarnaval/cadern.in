# Repository practices

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, issues, and score contributions. Keep task- or code-specific guidance near its subject.

## Design system

- Check `Atoms/Reference` before changing UI. Reuse `src/tsx/atoms` (e.g. `Button`, `Link`, `Input`, `Modal`, `Checkbox`, `Radio`, `Badge`) and `--ds-*` tokens from `src/styles/tokens.css`. Discuss new shared variants and update the reference with the atom.
- Keep domain components in `src/tsx/components` and screens in `src/tsx/screens`. Colocate styles and stories. Links navigate; buttons perform actions. Preserve native control semantics, accessible labels, and keyboard operation.
- Check visible focus, selected and disabled states, and narrow and wide layouts. For shared controls, also check forced colors. Don't rely on color, shadow, or motion alone to show focus or selection.
- For significant visual changes, agree on states using wireframes or stories before changing production screens. See the [adoption checklist](docs/tasks/011-design-system-foundations/ADOPTION.md).

## Storybook

- Colocate stories under flat titles: `Atoms/Name`, `Components/Name`, or `Screens/Name`. Render `*View`, not connected wrappers. Inject fixture props and callbacks; avoid Firebase, external requests, real audio, and persisted app data.
- Cover relevant default, empty, loading, error, and permission states. Use `play` functions to assert interaction outcomes. Inspect visual changes in a browser; type checks and builds don't replace that.
- Run `npm run typecheck:storybook`. Start `npm run storybook`, then run `npm run test:storybook` with Chromium installed. Use `npm run build-storybook` to check static output. See the [Storybook guide](.storybook/README.md) for fixtures, route parameters, and runner setup.

## Unit and integration tests

- Colocate Vitest `*.test.ts` files with the logic under test. Assert observable behavior with deterministic inputs, including boundaries and failures. For a regression, first show a focused test failing and keep it after the fix.
- Prefer pure functions for domain rules and state transitions. Mock at dependency boundaries rather than asserting private implementation details. Use Storybook for UI interactions and Firebase emulators for authorization, rules, and persistence.
- Run `VITE_USE_EMULATORS=true npm test -- --run <file>` without real credentials. Omit `<file>` for the full unit suite. Use the dedicated scripts in `package.json` for rules, Functions, migrations, and E2E. Default to demo data, not staging or production.

## Formatting and language

- Match nearby code. TypeScript/TSX typically uses two spaces, double quotes, and semicolons. Don't use `.js` extensions in local imports or reformat unrelated code.
- Use English for identifiers, code comments, and this guide. Keep UI copy and contributor-facing documentation in Brazilian Portuguese.
- Run `npm run lint`, `npx tsc --noEmit`, and `git diff --check` as applicable. Don't suppress type or lint errors just to pass a check.

## Task workflow

1. Check the issue, checkout state, and existing `TASK.md` before coding. For planned work, keep the objective, requirements, plan, and validation in `docs/tasks/NNN-name/TASK.md`. Link the milestone where applicable; don't create a duplicate record.
2. Agree on scope, acceptance criteria, failure cases, and checks before implementing a plan. Split workstreams only if they can be developed and integrated independently, with an explicit base and ownership. Preserve unrelated changes.
3. Make focused Conventional Commits and reference the task where applicable. Report what changed, which checks ran, and what remains.
4. Keep existing statuses: `open`, `in-progress`, `blocked`, `completed`, and `cancelled`. `completed` means accepted, not merged or deployed. Track merges, feature flags, pending checks, and rollout separately.
5. Target PRs at `main`, not `staging`. Link the issue, include test evidence, and add screenshots for visual changes when useful. Plan or review approval alone doesn't authorize pushing, opening a PR, merging, or deploying.

## Routes, permissions, and configuration

- Define paths in `src/lib/routes.ts` and bind them to screens in `src/tsx/App.tsx`. Update the [app flow map](docs/APP_FLOWS.md) when routes or journeys change. Flags and hidden controls don't replace backend authorization or security rules.
- Keep the website, exporter renderer, and Electron boundaries intact. Don't commit credentials or enable flags in shared environments as a side effect of local work.
