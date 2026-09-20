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
- [ ] **Upload a brand-new score** (one whose `scores/{id}` document does not
      exist yet) and confirm it completes. This path was broken before — both
      rule sets resolve the project by reading the score document, and
      `uploadScore` used to create it last, so Storage fell through an
      `!exists` escape hatch and the Firestore revision write was denied
      outright. Verify on staging before production; there is no automated
      coverage, since it is entirely Firestore/Storage interaction and the
      emulator harness does not exist yet
- [ ] Upload a **second revision** to that same score — the existing-score path
      is unchanged but shares the reordered code
- [ ] **Confirm revision 1 survived.** Open it explicitly and check its files
      still resolve. `createScore` and `createRevision` both use `setDoc`, so a
      second upload landing on revision 1 instead of 2 overwrites it silently —
      there is no error to notice
- [ ] Confirm files landed under `scores/{id}/{rev}/…` and that the score opens
- [ ] Force a failed upload if you can (kill the network partway) and confirm
      the half-created score does not appear in the collection
- [ ] Upload a pre-v2 folder — expect it to succeed with a `METAJSON_LEGACY`
      deprecation warning, not a failure

## 5. Export app (not deployed, but exercises the same pipeline)

The export app has no packaging yet (008), so it only runs from a checkout.
These are not deploy gates — but it calls `parseUploadedFiles` and `uploadScore`
unchanged, so a failure here is a failure in shared code that *is* deployed.

Run with `npm run export-app:dev`, against staging.

- [ ] Log in; confirm the session survives quitting and reopening the app
      (Firebase Auth uses IndexedDB in the renderer — reasoned, not verified)
- [ ] Export a score, then upload it — expect **zero** warnings, since the
      folder carries a v2 manifest and nothing is inferred
- [ ] The project picker lists every project where you are editor or above, and
      preselects your Acervo
- [ ] Upload to a **shared band project**, not just the Acervo, and confirm the
      score shows up there on the website
- [ ] Re-export and re-upload the same score. The panel should warn that it
      already exists and name the revision it will create **before** you press
      Enviar; afterwards, check revision 1 is intact
- [ ] Export a score with **duplicate instruments** (two trumpets) and confirm
      both parts upload and are distinguishable
- [ ] Part names on the website match what MuseScore calls them, not filenames

## Known pre-existing issues this deploy does *not* fix

None are regressions from this branch. Listed because they were confirmed while
working on it, and the first one silently breaks uploads.

> Three upload bugs listed here previously — the `songs/` prefix, `storage.rules`
> reading removed fields, and the `!exists` write hatch — are **fixed on this
> branch**. They are what the new-score upload check above exercises.

- [ ] **Invitation acceptance is denied by the rules.** `acceptUserProjectInvitation`
      updates `projects/{id}.members` as the invitee, who has no role yet, so the
      `projects` update rule evaluates `null in ['owner','admin']`. Currently
      masked by `FEATURE_FLAG_AUTH_ENABLED`.
- [ ] `scripts/verifyAssets.ts:4` imports `../types/docs.js` — a `.js` extension
      in a local import path, which the project conventions forbid. Harmless,
      trivial.

## Known gaps, recorded rather than fixed

- The export app's success state names the score id but cannot link to it;
  that needs `shell.openExternal` and a base URL the app does not have.
- Re-uploading an existing score does **not** refresh the score document's
  title, composer or tags — only `latestRevisionId` moves, and there is no
  metadata-only edit anywhere either. A correction currently has no way to
  reach the site at all. Tracked in `TECH_DEBT.md`.

## Rollback

- Site: redeploy the previous hosting release from the Firebase console.
- Data: `npm run migrate -- --to 202604271800 --execute`.
- The two are independent, but if you roll back the data you must also roll back
  the site, or part labels will double up again.
