# Instrument identification

How a part in a MuseScore file becomes a cadern.in `Instrument`.

## Three vocabularies

| # | Vocabulary | Example | Where it lives |
|---|---|---|---|
| 1 | cadern.in `Instrument` | `trompete`, `tuba eb` | `types/instrument.ts` |
| 2 | MuseScore **short** id | `bb-trumpet`, `bass-eb-tuba` | `<Instrument id="…">` in the `.mscx` |
| 3 | MuseScore **long** MusicXML sound id | `brass.trumpet.bflat` | `<instrumentId>` in the `.mscx` |

2 and 3 describe the same part and sit on the same `<Instrument>` element, so a
reader of the `.mscx` has both. Consumers that go through an API see only one.

## Who sees which

| Consumer | Sees | Comes from |
|---|---|---|
| Export app — `scripts/lib/scoreMeta.ts` → `scoreInstrument.ts` | short | `mscore --score-meta` JSON |
| MuseScore plugin — `plugin/caderninInstruments.js` | both | QML `part.instrumentId` |
| Anything reading the `.mscx` directly | both | the XML |
| Web app upload — `src/instrument.ts` | neither | guesses from the **filename** |

The export app only ever observes short ids in practice; the long ids are
accepted defensively, and are what the plugin mostly deals with. The plugin's
switch lists both forms for the same instrument (`"brass.trombone"` and
`"trombone"` side by side), which suggests the value MuseScore returns from QML
has changed across versions — treat it as "either could arrive".

The web app is the odd one out: on upload it has no MuseScore process and no
`.mscx`, only the exported files, so `parseInstrument` pattern-matches the
filename. That is why filenames are currently instrument-derived, and why
arbitrary part names need the instrument carried in `.metajson` instead.

## Why `hasEb` still exists

`scoreInstrument.ts` picks between `tuba` and `tuba eb` by regex-ing the
localized part name for "eb"/"e♭". That looks like a hack because, for the short
vocabulary, it is — those ids are already unambiguous:

```
bb-tuba          → tuba
bb-tuba-treble   → tuba
eb-tuba          → tuba eb
eb-tuba-treble   → tuba eb
bass-eb-tuba     → tuba eb
```

The long vocabulary is lossier. Verified against
`test-scores/all-instruments.mscz`:

```
SHORT bb-tuba           →  LONG brass.tuba
SHORT bb-tuba-treble    →  LONG brass.tuba
SHORT eb-tuba-treble    →  LONG brass.tuba
SHORT bass-eb-tuba      →  LONG brass.tuba.bass
```

`brass.tuba` covers both Eb and Bb tubas, so on that id alone the part name is
the only signal available. `hasEb` is therefore scoped to `brass.tuba` (and the
bare `tuba` id) and is not consulted for any short id.

**Removing it** means guaranteeing the short id is always available — see the
`hasEb` entry in `TECH_DEBT.md`. The plugin has the same problem and its own copy
of the heuristic (`hasEbInPartName` in `plugin/musescoreInstruments.js`).

## Treble-clef variants

MuseScore suffixes `-treble` on the short id for the treble-clef version of an
instrument (`euphonium-treble`, `bb-sousaphone-treble`). Clef does not change
which book a part belongs in, so `stripTrebleSuffix` resolves them to the
concert-pitch id before lookup. The long vocabulary makes no such distinction —
`brass.euphonium` covers both.

## Two implementations, already drifted

The same mapping exists twice, independently:

- `scripts/lib/scoreInstrument.ts` (TypeScript, export app)
- `plugin/caderninInstruments.js` (JavaScript, MuseScore plugin)

They have diverged in both directions:

| | TS only | Plugin only |
|---|---|---|
| ids | `eb-clarinet`, baritone sax (all forms), sousaphone (all forms), generic `-treble` handling | `brass.trombone.tenor`, `brass.trumpet`, `c-trumpet`, `wind.reed.clarinet`, `clarinet.bflat`, `clarinet`, `saxophone.alto`, `alto-sax`, `saxophone.soprano`, `soprano-sax`, `saxophone.tenor`, `tenor-sax` |

The plugin also falls back to matching on the part name (`_matchByName`) when an
id is unknown, where the TypeScript map returns `undefined`.

A part the export app maps fine can therefore be unrecognised by the plugin, and
the reverse. Unifying them is tracked in `TECH_DEBT.md`.

> Unrelated but adjacent: `plugin/` and `plugins/` both exist, three of their four
> shared files differ, and `plugins/` has no `caderninInstruments.js`. Which is
> canonical is unclear.

## Proposal: one declarative table

### Rejected first: adopting MuseScore ids wholesale

The obvious-looking fix is to drop the cadern.in vocabulary and use a subset of
MuseScore's, since theirs is the most complete. It does not work, because the two
are not the same kind of identifier.

A cadern.in `Instrument` is not "what instrument is this part written for" — it is
**"which part book does this go in"**. Seven MuseScore ids collapse onto `tuba`
(`bb-tuba`, `bb-tuba-treble`, `sousaphone`, `bb-sousaphone`,
`bb-sousaphone-treble`, `brass.tuba`, `brass.sousaphone`) because a sousaphone
player reads the tuba book and clef does not change the book. Meanwhile `tuba` and
`tuba eb` stay distinct, because transposition does.

So the vocabulary is deliberately coarser than MuseScore's, along axes MuseScore
does not model. Picking `bb-tuba` as the canonical name for a book that also holds
sousaphones would be a type-level lie, and these strings are musician-facing —
they appear in filenames, PDF part labels and the UI.

It would also not reduce maintenance, which is the actual pain. The lookup table
is large because of the many-to-one collapse, not because the names differ; after
a rename you would still map seven ids onto one. And MuseScore changed ids between
3 and 4 (hence the plugin listing `"brass.trombone"` and `"trombone"` side by
side), so adopting their vocabulary turns their renames into our Firestore
migrations.

Worth noting: of the two MuseScore vocabularies, the **MusicXML** one is closer to
our granularity — `brass.tuba` already collapses the clef and pitch variants. It is
still not sufficient alone, since it cannot separate Eb from Bb and keeps
sousaphone distinct from tuba.

### Proposed: invert the mapping, generate the consumers

Keep the cadern.in vocabulary. Move ownership of the mapping from four scattered
places into one table, and derive the rest from it.

```ts
// types/instruments.ts
export const INSTRUMENTS = [
  {
    id: "tuba",
    musescore: ["bb-tuba", "sousaphone", "bb-sousaphone"], // -treble implied
    musicxml: ["brass.sousaphone"],                        // brass.tuba is ambiguous
    aliases: ["tuba", "sousafone", "sousaphone"],
  },
  {
    id: "tuba eb",
    musescore: ["eb-tuba", "bass-eb-tuba"],
    musicxml: ["brass.tuba.bass"],
    aliases: ["tuba eb"],
  },
  // …
] as const;

export type Instrument = (typeof INSTRUMENTS)[number]["id"];
```

Derived from it:

| Consumer | Today | After |
|---|---|---|
| `zInstrument` / `Instrument` | hand-written enum | `INSTRUMENTS[number]["id"]` |
| `scoreInstrument.ts` `ID_MAP` | hand-written | flatten `musescore` + `musicxml` |
| `src/instrument.ts` aliases | hand-written | flatten `aliases` |
| `allInstruments` (`PdfGenerator`) | hand-written subset | table order, minus an opt-out flag |
| `plugin/caderninInstruments.js` | hand-written duplicate | **generated** by a script |

The plugin file must stay committed, since MuseScore loads plugin sources directly
and there is no build step on that side. A CI check that regenerating produces no
diff is what actually prevents the drift documented above.

Two things stay as code, not data:

- **`-treble` normalization** is mechanical, so it stays a function
  (`stripTrebleSuffix`) rather than doubling every `musescore` entry. The same
  treatment could apply to the `bb-`/`eb-` prefixes, parsing them as a
  transposition instead of enumerating every combination.
- **Ambiguous ids** — `brass.tuba` and bare `tuba` — cannot live in the table at
  all, because they map to different instruments depending on the part name. They
  need an explicit escape hatch alongside it, which is where `hasEb` survives.

### What this buys

- "Add an instrument" becomes one edit instead of the six-step checklist below.
- The plugin can no longer drift from the export app.
- No Firestore migration — `parts[].instrument` values are unchanged. That is the
  main reason to prefer this over renaming.

### What it costs

- A codegen script plus a CI drift check.
- `INSTRUMENTS` must be importable from Node (`scripts/`), the browser (`src/`),
  and a codegen script — so it belongs in `types/`, with no runtime dependencies.
- Ambiguous ids still need bespoke handling; the table does not eliminate them.

## Adding an instrument

1. Add the value to `zInstrument` (`types/instrument.ts`).
2. Map every MuseScore id form in `scripts/lib/scoreInstrument.ts` — both
   vocabularies, and check whether a `-treble` variant exists.
3. Add filename aliases in `src/instrument.ts`. `parseInstrument` lowercases and
   turns `_-.` into spaces but **does not strip accents**, so an accented
   spelling needs its own entry (`barítono` as well as `baritono`).
4. Add it to `allInstruments` in `src/tsx/PdfGenerator.tsx`, or parts will upload
   successfully and then silently never appear in any songbook.
5. Mirror the id mapping into `plugin/caderninInstruments.js`.
6. Extend the fixture table in `scripts/lib/scoreInstrument.test.ts`.
