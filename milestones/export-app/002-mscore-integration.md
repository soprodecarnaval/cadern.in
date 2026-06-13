# 002 — mscore integration

**Goal:** Locate the user's MuseScore 4 binary (autolocate + manual fallback,
persisted), and list a score's parts (name, instrument id, page count) via the
CLI. Verify the CLI output format before building UI on top of it.

**Depends on:** 001.

## mscore location (not bundled)

MuseScore is **not** bundled — we use the user's MS4 install.

1. **Autolocate** MS4 per platform, first hit wins; also try `PATH`:
   - macOS: `/Applications/MuseScore 4.app/Contents/MacOS/mscore`
   - Windows: `C:\Program Files\MuseScore 4\bin\MuseScore4.exe`
   - Linux: `mscore4`/`mscore` on `PATH`, common `/usr/bin`, Flatpak, AppImage
2. **Prefill** the located path in a settings field.
3. **Manual locate** via native file picker when autolocate fails or the user
   overrides.
4. **Persist** the chosen path (settings file in `app.getPath("userData")` or
   `electron-store`), reused on next launch.
5. **Not-found UX:** clear message + link to musescore.org, block export until
   a valid binary is set. Validate by running `mscore --version`.

MS4-only — drop the hardcoded MuseScore 3 path in `detectMscore`.

## Confirmed (runtime, MS4.7.2)

`--score-meta` prints clean JSON to **stdout** (no `-o`), wrapped as
`{ "metadata": { … } }` — parse `.metadata`. It contains:

- metadata: `title`, `composer`, `previousSource`, `poet`, `subtitle`
- `parts[]` — each with `id`, `name`, **`instrumentId`**, and staff flags
  (`hasPitchedStaff`, `hasDrumStaff`)
- whole-score `pages`, `measures` (no per-part pages — column dropped, decided)

Observed `instrumentId` values (MS4 style): `flute`, `bb-clarinet`,
`bb-trumpet`, `alto-saxophone`, `tenor-saxophone`, `trombone`, `euphonium`,
`tuba`; percussion `bass-drum`, `triangle`, `wood-blocks`.

## instrumentId → cadern.in mapping (new, MS4 ids)

Map by **`instrumentId`**, NOT by name — `parseInstrument(name)` fails on
Portuguese names (e.g. `"Eufônio Bb"` has no alias). New shared module
`scoreInstrument.ts`:

| instrumentId        | cadern.in `Instrument` |
|---------------------|------------------------|
| `flute`             | `flauta`               |
| `bb-clarinet`       | `clarinete`            |
| `bb-trumpet`, `c-trumpet` | `trompete`       |
| `alto-saxophone`    | `sax alto`             |
| `soprano-saxophone` | `sax soprano`          |
| `tenor-saxophone`   | `sax tenor`            |
| `trombone`          | `trombone`             |
| `euphonium`         | `bombardino`           |
| `tuba`              | `tuba` (or `tuba eb` if name contains "eb") |
| anything else (`bass-drum`, `triangle`, …) | `undefined` → incompatible |

Extend ids as new scores surface them. Unknown id → incompatible (greyed out).

## Duplicate parts

Parts can share `instrumentId` **and** `name` (e.g. two `Trumpet`, two
`Trombone`). Use the part `id` to disambiguate selection keys and **output
filenames** (005) so `Trumpet.svg` instances don't collide.

Confirm `mscore -j` runs headless while the MuseScore GUI is open
(single-instance check).

## Steps

1. Rewrite `detectMscore()` MS4-only (per-platform paths above), returning a
   path or `undefined`. Add `validateMscore(path)` via `--version`.
2. Settings store helpers: `getMscorePath()` / `setMscorePath(path)` persisted
   in `userData`.
3. `listParts(mscore, mscz)` runs `--score-meta`, parses `.metadata.parts`, and
   returns `{ id, name, instrumentId, instrument }[]`, where `instrument` comes
   from the new `scoreInstrument.ts` instrumentId map and is `undefined` when
   incompatible.
4. IPC handlers in `electron/ipc.ts`: `getMscorePath`, `setMscorePath`,
   `locateMscore` (dialog), `listParts(msczPath)`.
5. Expose via preload.

## Files

- `scripts/lib/mscz.ts` (extend) or `scripts/lib/scoreMeta.ts`
- `scripts/lib/scoreInstrument.ts` (new — instrumentId → cadern.in map)
- `electron/ipc.ts`, `electron/preload.ts`, `electron/settings.ts`
- `src/export-app/global.d.ts` (types)

## Acceptance

- App autolocates MS4 on this machine and pre-fills the path; manual locate
  works when cleared; the choice survives a restart.
- A temporary dev call to `window.api.listParts(path)` logs the parts array with
  correct instrument labels and page counts for a known score.
