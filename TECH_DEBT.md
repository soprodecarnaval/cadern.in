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
