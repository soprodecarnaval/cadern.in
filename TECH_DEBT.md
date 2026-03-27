# Tech Debt

## User displayName collision
Create displayName index and don't allow users to set their displayName to some existing one. We'll need to route displayName editing through a cloud function.

## Admin moderation system
Implement mechanisms for admins to review user-uploaded scores. Currently all uploads are immediately publicly visible.

## Storage monitoring
Implement mechanisms for admins to monitor storage usage and set per-user upload limits.

## Purge script for soft-deleted songs
Create a script that permanently deletes soft-deleted songs (Firestore docs + Storage files) after a retention period.

## Refresh CollectionContext after upload
Currently `CollectionContext` loads data once on mount. After a user uploads a new score, the collection is stale until page reload.

## Multi-instrument parts
`Part.instrument` is currently a single `Instrument` value. In theory a part (e.g. a doubling part) could cover more than one instrument. The type should be changed to `instrument: Instrument | Instrument[]` and the instrument detection in `parseUploadedFiles` updated accordingly.

## Rename Song → Score and retire legacy collection format
"Score" is the precise domain term for a notated piece with multiple instrument parts. Tackle in four steps:

**Step 1 — Clear the name clash (mechanical)**
Rename `Score`/`zScore`/`Collection`/`zCollection` in `types.ts` and all references → `LegacyScore`/`zLegacyScore`/`LegacyCollection`/`zLegacyCollection`.

**Step 2 — Rename Song → Score (mechanical)**
Rename all `Song`/`song` identifiers to `Score`/`score` in code (`SongDoc` → `ScoreDoc`, `songId` → `scoreId`, `getUserSongs` → `getUserScores`, etc.). Keep the Firestore collection name behind a constant `SCORES_COLLECTION = "songs"` so the data migration is decoupled.

**Step 3 — Retire the legacy format (behavioral)**
Replace all `LegacyScore` usages (CollectionContext, SongBookTable, PDF generation, search, etc.) with Firestore-native reads through the `db.ts` abstraction layer. Fix `validateParsedScore` to validate against `zScoreDoc`+`zRevisionDoc` instead of `zLegacyScore`. Once no references to `LegacyScore` remain, delete `types.ts` legacy types.

**Step 4 — Firestore collection migration (ops)**
Migrate data from `songs` → `scores` collection, update the collection name constant, update storage paths, `storage.rules`, and `firestore.indexes.json`.
