# 010 — Arbitrary part names via metajson v2

**Goal:** A part may be called anything the arranger wants — including
`All your base are belong to us 💸🤠 11/22` — and survive export → upload →
songbook with that name intact.

**Depends on:** 005 (export). Changes the web app's upload path as well.

## Why filenames cannot carry this

`src/lib/parseUploadedFiles.ts` infers **both** the part name and the instrument
from the filename. That forces filenames to be instrument-derived, and breaks on
arbitrary names twice over:

- `safeFilename` rewrites `/` to `-`, so the name is already lossy on disk.
- A name with no instrument word makes `parseInstrument` return `undefined`, so
  the upload warns `INSTRUMENT_NOT_DETECTED` and the part is dropped.

The web app has no MuseScore process and no `.mscx` at upload time, so it cannot
re-derive the instrument. The only out-of-band channel between the export app and
the uploader is `.metajson` — which the exporter already writes and the uploader
already reads.

## Schema

`.metajson` gains an explicit `parts` array listing every file by name. No
pattern matching anywhere: page order is array order.

```json
{
  "composer": "…",
  "previousSource": "…",
  "poet": "…",
  "parts": [
    {
      "name": "All your base are belong to us 💸🤠 11/22",
      "instrument": "trompete",
      "svg": ["Marcha-trompete-a-1.svg", "Marcha-trompete-a-2.svg"],
      "midi": "Marcha-trompete-a.midi"
    }
  ]
}
```

Filenames stay instrument-derived and disambiguated (`-a`, `-b`), but become pure
transport — never displayed. The letter suffixes stop being a product concern.

**Rejected:** storing a filename stem (`"file": "Marcha-trompete-a"`) and globbing
for the rest. It is more compact but keeps one filename convention load-bearing —
the `-N` page suffix — which the uploader would still have to parse.

## The trap: `part.name` is currently a storage key

`parseUploadedFiles` sets `fileMap` keys as `parts/${partName}.midi`, and
`uploadScore` reads them back by the same key. Once names are arbitrary, that
yields `parts/All your base…11/22.midi` — a path separator injected into Firebase
Storage.

`ParsedPart` must therefore carry both:

- `name` — the display name, arbitrary, stored in `PartData.name`
- `basename` — the file stem, used for `fileMap` keys and Storage paths

This split is the substance of the milestone; everything else follows from it.

## Steps

1. `scripts/lib/exportScore.ts` — write `parts[]` into the metajson. Keep
   `buildPartBasenames` unchanged.
2. `src/lib/parseUploadedFiles.ts` — consume `parts[]` verbatim: no
   `parseInstrument`, no `extractPageNumber`. Emit a warning and refuse to guess
   when it is absent.
3. `src/lib/uploadScore.ts` — key `fileMap` lookups off `basename`, not `name`.
4. `src/instrument.ts` + `PdfGenerator` — use the explicit name for part labels;
   `extractPartLabel` remains only for pre-v2 data.
5. `scripts/backfillMetajson.ts` — new. Points at an exported folder, applies the
   old inference rules once, offline, and writes a v2 metajson. The inference
   logic moves here and out of the web app.
6. Add `METAJSON_MISSING_PARTS` to `WarningCode` (`src/lib/warningMessages.ts`)
   pointing at re-export or the backfill script.

## Migration

Three of the four surfaces need nothing. Verified, not assumed:

**Firestore — nothing.** `PartData.name` changes meaning for new revisions
(filename stem to authored name), but old revisions cannot be backfilled: the
authored name was never stored, so it is unrecoverable. They do not need it —
revisions are immutable historical records and both shapes render:

```
"cadern.in test-trompete-a"  ->  label "a"   (pre-v2)
"Trompete 1"                 ->  label "1"   (v2)
```

The collection therefore carries mixed `name` semantics, by design.

**Storage — nothing.** The key today is `parts/${part.name}.midi`, where
`part.name` *is* the filename stem (`uploadScore.ts:100`). After the split it is
`parts/${basename}.midi` — the same string. The split changes which field feeds
the key, not its value.

**Exported folders on disk — the only real surface.** Two producers of pre-v2
sidecars:

- `scripts/exportMscz.ts`, which does not write the sidecar itself: `mscz.ts`
  asks MuseScore to emit `${basePath}.metajson`, so pre-v2 is *MuseScore's own*
  metadata dump. That is why `readMetajson` reads only `composer`,
  `previousSource` and `poet`.
- The export app, which has never shipped — no `electron-builder.yml`, no tags,
  `version: 0.0.0`. There are no installs in the wild producing pre-v2 output.

So the CLI, not the export app, was what kept generating folders a v2-only
uploader would reject. **`scripts/exportMscz.ts` has been retired** rather than
upgraded, along with `generateAssets` — the function that asked MuseScore to
write the pre-v2 sidecar in the first place.

D2 therefore does not depend on 008, as previously recorded here. Nothing
produces pre-v2 folders any more, so removing the inference path depends only on
whether anyone still holds one they cannot re-export. The inference moved with D2 rather than being deleted: it lives in
`scripts/lib/inferParts.ts` and serves only `scripts/backfillMetajson.ts`, which
is the one remaining way to upgrade a folder exported before the manifest
existed.

### Why detection keys on `version`, not on `parts`

MuseScore's own metajson may itself contain a `parts` array with a different
shape. Treating "has a `parts` key" as the v2 signal would misread a MuseScore
dump as ours, so `zMetajson` requires `version: 2` as a literal discriminator.

### Sequencing

| Phase | | Breaks |
|---|---|---|
| A | Exporter writes v2 | nothing |
| B | Uploader accepts both: v2 uses the manifest, pre-v2 infers as today and warns | nothing |
| C | `scripts/backfillMetajson.ts`; mark `exportMscz.ts` deprecated | nothing |
| D1 | ✅ Retire `exportMscz.ts` — nothing produces pre-v2 sidecars any more | nothing |
| D2 | ✅ Remove the inference path; pre-v2 is refused | pre-v2 folders still on disk, deliberately |

B before D avoids a flag day: the new path lands while old folders still work, so
the two can be verified independently.

## Acceptance

- A part named `All your base are belong to us 💸🤠 11/22` round-trips from
  MuseScore through export and upload with its name intact.
- Its Storage paths contain no `/` beyond the intended prefix.
- Its songbook part label shows the name, not `-a`/`-b`.
- A pre-v2 folder produces one clear warning, not a silent mis-parse.
- Duplicate instruments still get unique filenames.
