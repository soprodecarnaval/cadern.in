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

## Refactor away collection format (zScore / zCollection)
`zScore` in `types.ts` is the legacy static-collection format. It is currently used as a structural proxy in `validateParsedScore` in `parseUploadedFiles.ts`. Once the collection format is fully replaced by the Firestore-native types (`zSongDoc`, `zRevisionDoc`), `zScore` and `zCollection` should be removed and `validateParsedScore` should validate against the Firestore doc schemas instead.
