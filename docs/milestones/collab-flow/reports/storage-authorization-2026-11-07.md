# Storage authorization — staging verification, 2026-11-07

## Cause

Both legacy score and songbook upload rules read three Firestore documents:
entity → project → membership. Live Firebase Storage permits two document
lookups per request. The Storage emulator allowed this rule, masking the defect.

Read-only staging checks confirmed the reported songbook and project were live,
the account was an enabled project owner, deployed rules matched the repository,
and the Storage service agent had Firestore access. An isolated live probe then
failed under the three-read rule and succeeded under a two-read rule for the
same owner and file. Original rules were restored and the probe file removed.

## Change

All new client uploads use the project namespace:

- `projects/{projectId}/scores/{scoreId}/{revisionId}/…`
- `projects/{projectId}/songbooks/{songbookId}/{revisionId}/covers/…`

Rules read only the project and membership. Score writes require owner, admin
or editor; cover writes require owner or admin. Deleted projects deny writes.
Authorization covers the project's Storage namespace without reading an entity
document; Firestore separately enforces permission to save records and revisions.

Existing paths and download URLs remain unchanged and publicly readable.
Legacy score/songbook prefixes reject all client writes, including overwrites,
metadata changes and deletes. Admin maintenance scripts continue using stored
paths. No dataset or schema migration is required.

## Deployment and verification

Storage rules and the staging website were deployed directly from
`fix/storage-project-authorization`, without merging to `main` or running CI.
No Functions deployment or production changes were performed.

Local checks passed:

- 198 unit tests, including score upload and cover-save regressions.
- 103 Firestore/Storage rules tests, including a two-read lookup-budget guard.
- Staging website and export-app builds; targeted source/rules-test lint.

Nine live staging checks passed using the app's upload functions and disposable
projects authenticated as the existing owner:

1. New score: all five asset types uploaded and its first revision committed.
2. New revision: predecessor and revision numbering preserved.
3. Fork: destination namespace used and source lineage retained.
4. Cover: uploaded, download URL obtained, songbook revision saved, public read.
5. Cross-project score and cover writes denied.
6. Editor, reviewer and admin role boundaries enforced.
7. Legacy paths publicly readable; uploads, metadata changes and deletes denied.
8. Deleted project blocks score and cover uploads.
9. Staging website responds HTTP 200.

Disposable files, score/revision records, songbook/revision records, projects and
memberships were removed. No existing songbook content was modified. Browser UI
interaction was not automated; the original reported cover should be retried in
the deployed website. Export-app users need the rebuilt client to upload using
the new paths. The export-app build passed; installers were not packaged or
distributed.

The changes remain on the feature branch and must be committed and merged before
a later deployment from `main`, which otherwise contains the legacy upload code
and rules.
