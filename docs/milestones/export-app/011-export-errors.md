# 011 — Export error handling

**Goal:** Export failures are actionable and in Portuguese, and re-exporting into
a folder that already has files is a prompt rather than a crash.

**Depends on:** 005 (export).

## Language policy

`CONTRIBUTING.md` ("Política de Idioma") puts code in English and user-facing
text in pt-BR. The web app already implements this: `src/result.ts` emits a
stable `WarningCode`, and `src/lib/warningMessages.ts` translates at the
presentation layer. Library code never carries Portuguese.

The export app does not follow it. `scripts/lib/exportScore.ts` and
`msczArchive.ts` throw bare `Error`s with prose messages — correctly English, per
policy — and `App.tsx:runExport` renders them verbatim:

```ts
setError(e instanceof Error ? e.message : String(e));
```

So users see `Select at least one compatible part`, `Export destination is not a
directory`, `This score was saved in MuseScore 3.6.2…`, and worst of all the raw
`Error invoking remote method 'score:runExport': EEXIST: file already exists,
copyfile …` in an otherwise Portuguese UI.

## Destination collision

`exportScoreFolder` copies with `fs.constants.COPYFILE_EXCL`, so a second export
into the same folder throws `EEXIST`. Refusing to overwrite silently is right;
the raw error is not. Export → spot a typo → fix → re-export to the same folder
is a normal flow.

Prompt instead: **Overwrite** / **Choose another folder** / **Cancel**. This is
also why the error needs a machine-readable kind — the renderer must recognise a
collision without pattern-matching message text.

## Steps

1. Typed export errors carrying a code and meta, thrown by `scripts/lib`.
   Serialisable across the Electron IPC boundary, which flattens `Error`
   subclasses — so pass a plain `{ code, meta }` shape, not a class.
2. Extend `WarningCode` with the export codes; add pt-BR strings to
   `warningMessages.ts`. CLI callers (`scripts/exportMscz.ts`) keep the English
   default, which is correct for them.
3. `App.tsx` translates by code, falling back to the raw message for anything
   unrecognised.
4. On `EXPORT_DESTINATION_NOT_EMPTY`, show the three-way prompt. Overwrite
   re-runs with `COPYFILE_EXCL` disabled.
5. Preserve the existing rollback: on failure, already-copied files are removed.

## Acceptance

- Every error reachable from the export button renders in pt-BR.
- Re-exporting into the same folder prompts instead of throwing.
- Overwrite replaces the previous export cleanly.
- Cancelling leaves the destination untouched.
- `scripts/exportMscz.ts` still prints useful English errors.
