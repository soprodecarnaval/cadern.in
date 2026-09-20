# Production deploy checklist — `feat/exporter-app`

Covers the website changes on this branch. The export app itself is **not**
deployed by this: it has no packaging yet (008), so it only runs from a checkout.

## The one ordering constraint

**Run the part-name migration before deploying the site.** `createSongBook` now
prints `part.name` verbatim, where it previously stripped the song title from it.
Deploying first would make every multi-part songbook header read
`OLHA PRO CÉU: OLHA PRO CÉU - SAX ALTO`.

Migration-first has no broken window. The old renderer strips a title prefix
that migrated names no longer have, so it renders them unchanged — verify this
on staging rather than taking it on trust.

```
migrate (prod)  →  verify a PDF  →  deploy site
```

## 1. Verify on staging

`.env.local` points at `cadernin-staging.firebasestorage.app`. Everything below
was exercised there; repeat deliberately rather than assuming.

- [ ] `npm run build` passes (now type-checks `electron/` and `types/` too)
- [ ] `npx vitest run` — 79 tests
- [ ] `npx eslint src --ext ts,tsx --max-warnings 0`
- [ ] `cd functions && npm run lint && npm run build` — a bare `firebase deploy`
      runs these as a predeploy hook and will abort the whole deploy if they fail
- [ ] Generate a songbook PDF from a **multi-part** score on staging *before*
      migrating, and keep it to compare against
- [ ] Run the migration on staging, regenerate the same PDF, confirm part labels
      are unchanged or improved — never doubled
- [ ] Confirm the pre-migration site renders **post-migration** names correctly
      (this is what makes migrate-first safe)

## 2. Data migration

`202609201500_part_names` rewrites `parts[].name` on every revision. Dry-run on
staging reported **1073 of 1073 revisions, 0 skipped, 0 emptied**.

- [ ] Confirm which project `.env.local` / the service account point at — the
      earlier dry-run was **staging**, not production
- [ ] Export/back up Firestore before running (it rewrites 1073 documents)
- [ ] Dry run against production and read the output:
      `npm run migrate -- --to 202609201500`
- [ ] Check the summary line. A non-zero *skipped* count means revisions whose
      names did not match either legacy family; those keep filename-stem names
      and will render with the title doubled
- [ ] Execute: `npm run migrate -- --to 202609201500 --execute`
- [ ] Spot-check a handful of revisions in the console
- [ ] Rollback if needed: `npm run migrate -- --to 202604271800 --execute`
      (reconstructs `"title - name"`; renders identically but is not
      byte-identical to the original for the underscored family)

## 3. Deploy

- [ ] Merge to `staging` first, per the branch convention
- [ ] `npm run deploy` — note this is a **bare `firebase deploy`**: it pushes
      hosting, `firestore.rules`, `firestore.indexes.json`, `functions` and
      `storage.rules` together. Neither rules file is modified by this branch,
      but both will be (re)published as they currently stand
- [ ] Consider `firebase deploy --only hosting` if you want the site alone

## 4. Post-deploy verification

- [ ] Songbook PDF from a multi-part score: part labels read correctly
- [ ] Collection browse + search still work (`sax baritono` was added to
      `zInstrument`; existing data is unaffected, the enum only grew)
- [ ] Upload a folder exported by the export app — expect **zero** warnings
- [ ] Upload a pre-v2 folder — expect it to succeed with a `METAJSON_LEGACY`
      deprecation warning, not a failure

## Known pre-existing issues this deploy does *not* fix

None are regressions from this branch. Listed because they were confirmed while
working on it, and the first one silently breaks uploads.

- [ ] **Uploads write to a dead prefix.** `uploadScore.ts:55` builds
      `songs/${scoreId}/${revId}`, but the collection was renamed by
      `202604201809_songs_to_scores`, real files live under `scores/…`
      (confirmed from `StorageFile.path` values in Firestore), and
      `storage.rules` matches only `scores/{songId}/**`. Everything at `songs/…`
      hits the catch-all `allow read, write: if false`.
      Before fixing, check the bucket for orphans already written to `songs/` —
      this needs a service account with `storage.objects.list`, which the
      current one lacks.
- [ ] **`storage.rules` reads removed fields.** `canWriteSong` tests
      `project.ownerId` and `project.collaboratorIds`, both dropped by
      `202604201900_projects_roles` in favour of `members`/`memberIds`.
- [ ] **`storage.rules` has an open write hatch.** `!firestore.exists(...)` lets
      any authenticated user write arbitrary bytes under a score id that does
      not exist yet.
- [ ] **Invitation acceptance is denied by the rules.** `acceptUserProjectInvitation`
      updates `projects/{id}.members` as the invitee, who has no role yet, so the
      `projects` update rule evaluates `null in ['owner','admin']`. Currently
      masked by `FEATURE_FLAG_AUTH_ENABLED`.
- [ ] `scripts/verifyAssets.ts:4` imports `../types/docs.js` — a `.js` extension
      in a local import path, which the project conventions forbid. Harmless,
      trivial.

## Rollback

- Site: redeploy the previous hosting release from the Firebase console.
- Data: `npm run migrate -- --to 202604271800 --execute`.
- The two are independent, but if you roll back the data you must also roll back
  the site, or part labels will double up again.
