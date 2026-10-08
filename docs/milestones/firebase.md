# Firebase Integration Plan

## Overview

Migrate musicoteca from a static file-based SPA to a Firebase-backed application with auth, song uploads, revisioning, project management, and published songbooks.

## Data Model (Firestore)

```
users/{uid}
  displayName: string
  email: string
  createdAt: timestamp

projects/{projectId}
  title: string
  ownerId: uid
  collaboratorIds: uid[]
  createdAt: timestamp

songs/{songId}
  title: string
  composer: string
  sub: string
  tags: string[]
  projectId: string
  uploadedBy: uid
  latestRevisionId: string
  createdAt: timestamp

songs/{songId}/revisions/{revisionId}
  revisionNumber: int
  uploadedBy: uid
  uploadedAt: timestamp
  mscz: storagePath
  midi: storagePath
  parts: Part[]   ← svg[]/midi as Firebase Storage paths (same shape as current Part type)
  notes: string

songbooks/{songbookId}
  title: string
  ownerId: uid
  slug: string    ← URL-friendly identifier, unique
  isPublished: bool
  entries: [{ songId, revisionId, order, instrument? }]
  createdAt: timestamp
  updatedAt: timestamp
```

## Firebase Storage Layout

```
songs/{songId}/{revisionId}/
  score.mscz
  score.midi
  parts/{partName}.midi
  parts/{partName}-{n}.svg

songbooks/{songbookId}/pdfs/{instrument}.pdf
```

## Key Design Decisions

- **No Cloud Functions**: Export (SVG/MIDI generation from .mscz) runs locally via existing scripts. Users upload pre-exported assets.
- **Upload format**: multi-file picker accepting `.mscz` + `.midi` + `.svg` files; filenames are parsed to reconstruct `Part[]` (same logic as `scripts/indexCollection.ts`).
- **PDF generation at publish time**: when a songbook is published, the client generates one PDF per instrument represented in the songbook entries, uploads to Storage. The public page serves pre-stored download links (no on-demand generation).
- **Songbook access gate**: PDF download and web view are only available on the public `/songbooks/:slug` page. Unpublished songbooks are editable but not exportable.
- **Migrated content ownership**: all existing songs from `public/collection` are owned by the `cadern.in` org account.
- **Static collection deprecated**: after migration, `public/collection/collection.json` is no longer used. All data is served from Firestore + Storage.

## Phases

### Phase 1 — Firebase Setup
- [x] Add `firebase` and `react-router-dom` packages
- [x] `src/firebase.ts` — Firebase app init, export `auth`, `db`, `storage`
- [x] `.env` / `.env.example` for Firebase config keys
- [x] Update `vite.config.ts` to expose env vars
- [x] `firebase.json` + `.firebaserc` for Firebase Hosting with SPA rewrites

### Phase 2 — Migration Script
- [x] `scripts/migrateToFirebase.ts`
  - Reads `public/collection/collection.json`
  - Uploads all files (mscz, midi, svgs) to Storage under `songs/{songId}/{revisionId}/`
  - Writes Firestore `projects`, `songs`, and `songs/{id}/revisions/1` docs
  - All songs owned by hardcoded `cadern.in` org UID
  - Each existing project title → one Firestore `projects` doc
- [x] Add `migrate` npm script

### Phase 3 — Auth
- [x] `src/auth.tsx` — `AuthContext` with `currentUser`, `login`, `logout`, `register`
- [x] Login/register modal UI
- [x] Wrap app in `AuthProvider`

### Phase 4 — Data Layer
- [x] `src/collection.ts` — replace static JSON load with Firestore queries
- [ ] Update `types.ts`: add Firebase-aware variants of `Score`/`Revision`/`Part` with Storage paths
- [ ] `firestore.rules` — read-open for published content; writes require auth + project membership

### Phase 5 — Upload
- [ ] Upload song UI: multi-file picker (`.mscz` + exported `.midi` + `.svg` files)
- [ ] Parse filenames → reconstruct `Part[]` (reuse logic from `scripts/indexCollection.ts`)
- [ ] Write `songs/{id}` doc + `songs/{id}/revisions/1` subcollection doc
- [ ] Upload files to Storage

### Phase 6 — Projects
- [ ] Create project UI
- [ ] View project + song list
- [ ] Add/remove collaborators by email lookup
- [ ] Upload new revision to existing song (project members only)

### Phase 7 — Songbooks
- [ ] Migrate `SaveLoadModal` from localStorage to Firestore `songbooks/{id}`
- [ ] Publish flow:
  1. Generate one PDF per instrument (client-side PDFKit, same as current)
  2. Upload PDFs to `songbooks/{songbookId}/pdfs/{instrument}.pdf`
  3. Set `isPublished: true` on Firestore doc
- [ ] Add `react-router-dom`
- [ ] Route `/songbooks/:slug` → public view with instrument PDF download links + web score view

## Routing

```
/                    → main app (collection browser + songbook builder, public read)
/songbooks/:slug     → public songbook page (web view + PDF downloads)
```

## Security Rules (outline)

- `songs`, `revisions`: anyone can read; create requires auth; update requires auth + project membership (ownerId or collaboratorIds)
- `projects`: anyone can read; create requires auth; update requires ownerId or collaboratorIds
- `songbooks`: published songbooks are public read; private songbooks readable by owner only; write requires owner
- `users`: readable by owner only; writable by owner only
- Storage mirrors Firestore rules

## Open / Future Work

- Review system: comments on revisions (noted as future feature)
- Public project/song discovery page
- Google OAuth (email+password is sufficient for now)
