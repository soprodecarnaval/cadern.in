# Collaborative Flow — Design Spec

Status: **reviewed, ready for implementation**. Derived from `REQUIREMENTS.md` and
the current implementation. Supersedes the data-model sections of `firebase.md`.
Tasks live in the numbered files next to this one (§9).

## 0. Rollout

The whole milestone ships behind `FEATURE_FLAG_COLLAB_FLOW` (renamed from
`FEATURE_FLAG_AUTH_ENABLED`, default `false`). With the flag off, production is a
read-only public site, so the only compatibility constraint is that **read paths
used by flag-off code keep working** after every migration and rules deploy.

Each slice (§9) ships its own schema, migration, rules, rules tests and UI
together. There is no big-bang rules deploy at the end: a slice's rules are
deployed when its migration has run, and must keep accepting the reads flag-off
code performs. Legacy fields are only dropped in the final cleanup (M9).

**The export app is a production writer the flag does not cover.** It calls
`uploadScore` against prod regardless of the website's flag, and flag-off prod
reads the legacy shape (`scores/*/revisions` with `isLatest`, top-level score
metadata). So until launch (007), `uploadScore` **dual-writes**: the new shape
(`scoreRevisions`, `cachedMetadata`, …) plus the legacy revision doc and score
fields, so exporter uploads keep appearing on the flag-off homepage. Rules accept
both. Dual-writing is removed together with the legacy data in M9, and each
export-app release that changes the write path ships with its slice.

---

## 1. Entities

| Entity | Firestore location | Mutable? |
|---|---|---|
| USER | `users/{uid}` | yes |
| PROJECT | `projects/{projectSlug}` | yes |
| MEMBER | `projects/{projectSlug}/members/{uid}` | yes |
| SCORE (container) | `scores/{scoreId}` | yes |
| SCORE_REVISION | `scores/{scoreId}/scoreRevisions/{revisionId}` | **no** |
| SCORE_LINK | `projects/{projectSlug}/scoreLinks/{scoreId}` | soft-delete only |
| REVIEW_COMMENT | `scores/{scoreId}/scoreRevisions/{revisionId}/comments/{commentId}` | author edit / soft-delete only |
| SONGBOOK (container) | `songbooks/{songbookId}` | yes |
| SONGBOOK_REVISION | `songbooks/{songbookId}/songbookRevisions/{revisionId}` | **no** |
| INSTRUMENT_SONGBOOK | *not persisted* — derived artifact, generated client-side | n/a |
| INVITATION | `projects/{projectSlug}/invitations/{uid}` | yes |

Naming change (per open question): the codebase term `Revision` becomes
`ScoreRevision` throughout, so `SongbookRevision` is unambiguous.

**The two revision subcollections must have different names.** A collection-group
rule (`match /{path=**}/revisions/{id}`, deployed today for `getLatestRevisions()`)
matches *every* subcollection called `revisions`, and rules are OR'ed. Had songbook
revisions also been called `revisions`, that `allow read: if true` would have made
every unpublished songbook revision world-readable. Hence `scoreRevisions` /
`songbookRevisions`, and the existing `revisions` subcollection is copied to
`scoreRevisions` by migration M2b. The new model needs no collection-group query
on score revisions at all (§2.3.1), so `scoreRevisions` gets no such rule.

### 1.1 Relationships

```
PROJECT ─┬─ members: {uid -> role}
         ├─ SCORES         (scores.projectId == project.slug)
         ├─ SCORE_LINKS    (scores owned by other projects, by reference)
         └─ SONGBOOKS      (songbooks.projectId == project.slug)

SCORE ── latestRevisionId ──> SCORE_REVISION ──prev──> SCORE_REVISION ──prev──> null
                                    │
                                    └── comments/  (REVIEW_COMMENTs)

SONGBOOK ── currentRevisionId ──> SONGBOOK_REVISION ──prev──> ... ──> null
                                       │
                                       ├── entries[]  (pinned {scoreId, revisionId, index})
                                       └── covers{}   (per-instrument cover images)
```

---

## 2. Schema

### 2.1 `projects/{projectSlug}`

```ts
{
  title: string
  slug: string
  createdAt: Timestamp
  deletedAt: Timestamp | null    // NEW — soft delete

  // Query index ONLY, for the array-contains "my projects" lookup.
  // Never consulted for authorization — see 2.1.1.
  memberIds: uid[]
}
```

**Changes:** add `deletedAt`; **the `members` map moves to a subcollection**
(§2.1.1). There is no project-level publish flag: the homepage lists every live
score of every live project (§7.1). Project deletion becomes a soft delete; the hard
`allow delete` rule is removed. Exactly one member doc must hold `owner`.

A soft-deleted project **retains its member documents**, so an owner can restore it
with roles intact.

### 2.1.1 `projects/{projectSlug}/members/{uid}`

```ts
{
  uid: string
  role: "owner" | "admin" | "editor" | "reviewer"

  // Denormalized from users/{uid} at write time. Required, not convenience:
  // `users/{uid}` is readable only by that user (deployed rules), so there is
  // no other way for a member list to display anything but a raw uid.
  displayName: string

  addedBy: uid
  addedAt: Timestamp
}
```

**No `email`.** Member documents are publicly readable (member lists appear on
public project pages), so they carry only the user-chosen `displayName`.

**Why a subcollection rather than a map on the project doc.** The requirement is
that an ADMIN may grant `editor`/`reviewer` but never `admin`/`owner`, and may not
remove anyone. To enforce that on a map, a rule must learn *which* map key changed —
and Firestore rules can only report *how many* keys changed, never name them. The
workaround was to have the client declare the target uid in the same write and
validate the declaration, which cost a vestigial `lastMemberChange` field on the
project doc and forbade batching. With one document per member the uid is in the
path, so the rule reads it directly (§4.3):

```js
allow create, update: if isOwner(pid) || (
  isAdmin(pid) &&
  request.resource.data.role in ['editor', 'reviewer'] &&
  (!exists(resource) || resource.data.role in ['editor', 'reviewer'])
);
```

Each document is validated independently, so an admin can change several members in
one `writeBatch`.

**Costs, stated plainly:**

- **+1 rules `get()` per authorized operation.** Previously one `get()` on the
  project doc yielded both the role and `deletedAt`; now that is two gets. Worst
  case in this spec — an editor creating a songbook revision — is 4 document
  accesses against a limit of 10.
- **Member list costs one query + N document reads** instead of riding along in the
  project doc. Offset by the fact that it can finally show names.

**`memberIds` drift.** A rule cannot read a whole collection, so it cannot verify
that `memberIds` matches the member documents. Writes pair them in a `writeBatch`,
but the array can still drift. The failure is benign by design: a stray uid makes a
project appear in that person's "my projects" list while granting them nothing,
since every authorization check reads the member document. The array must never be
consulted for permissions.

```ts
const batch = writeBatch(db);
batch.set(doc(db, "projects", pid, "members", uid), { uid, role, displayName, ... });
batch.update(projectRef(pid), { memberIds: arrayUnion(uid) });
await batch.commit();
```

### 2.1.2 `projects/{projectSlug}/invitations/{uid}`

```ts
{
  fromUserId: uid
  toUserId: uid            // == the document id
  projectId: string        // == parent id; needed for the collection-group query
  role: "editor" | "reviewer"
  accepted: boolean | null

  // Denormalized for display: the invitee cannot read users/{fromUserId}, and
  // the admin's invitation log cannot read users/{toUserId}.
  projectTitle: string
  fromDisplayName: string
  toDisplayName: string

  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}
```

Moved from the top-level `invitations/{autoId}` collection to a deterministic path,
keyed by invitee. This is what lets the invitee create their own member document:
the rule locates the invitation without being told where it is (§4.3). One pending
invitation per user per project — re-inviting overwrites.

"My pending invitations" is a `collectionGroup("invitations")` query on
`toUserId == uid`, which needs a collection-group rule and a composite index
(`toUserId`, `accepted`, `deletedAt`) in `firestore.indexes.json`.

**Finding the invitee.** `getUserByEmail` (`db.ts`) queried `users` by email, but
`users/{uid}` is readable only by its owner — and nothing ever wrote `users/{uid}`
docs, so it could not have worked either way. Invites are **by username**, which is
the Firebase Auth `displayName`: a callable Cloud Function
`findUserForInvite({ projectId, displayName })` checks the caller is ADMIN+ of the
project, pages through Auth users for a trimmed, case-insensitive match, and
returns `{ uid, displayName }`, "not found" or "ambiguous" — never an email.
Display names are not unique, so an ambiguous match asks the invitee to rename.
Username suggestions and email invites are future work (§8).

> **Live bug this fixes.** `acceptUserProjectInvitation` (`src/lib/db.ts`)
> batch-updates `projects/{pid}.members` as the invitee. The invitee holds no role
> yet, so the deployed `projects` update rule evaluates `null in ['owner','admin']`
> → false and the write is denied. **Invitation acceptance does not work against the
> deployed rules**; it is masked by `FEATURE_FLAG_AUTH_ENABLED`. An auto-id
> invitation cannot be fixed in rules at all — the rule has no way to find the
> document — which is the same "cannot discover the key" limitation that drove the
> members change.
>
> Moving the member write to a subcollection is not enough on its own: the same
> batch adds the invitee to `projects/{pid}.memberIds`, which the project update
> rule restricts to ADMIN+. The project rule therefore gets an invitee clause that
> permits adding exactly `request.auth.uid` to `memberIds` when the invitee's
> member document exists after the batch (`existsAfter`, §4.3).

### 2.1.3 `projects/{projectSlug}/scoreLinks/{scoreId}`

```ts
{
  scoreId: string           // == the document id
  sourceProjectId: string   // the score's owning project; never == projectSlug
  addedBy: uid
  addedAt: Timestamp
  deletedAt: Timestamp | null
}
```

A project uses another project's score **by reference**: an EDITOR+ adds a link from
the web (score page or search results → "Adicionar ao projeto"). A linked score
appears in the project's score list and can be put in its songbooks like any owned
score, but it is still owned and revised by its source project — the linking
project cannot upload revisions to it. Wanting to change it is what a fork is for
(§5.3). One link per (project, score); re-linking after removal clears `deletedAt`.

### 2.2 `scores/{scoreId}` (container)

```ts
{
  projectId: string          // project slug
  uploadedBy: uid            // creator of revision 1
  latestRevisionId: string
  createdAt: Timestamp
  deletedAt: Timestamp | null

  // Cache of latestRevision.metadata, written transactionally with each new
  // revision. Read-only for list/search views; never authoritative.
  cachedMetadata: { title, composer, sub, tags }

  // Optional admin-authored corrections. Wins over revision metadata for display.
  // Absent fields fall through to cachedMetadata.
  metadataOverride?: Partial<{ title, composer, sub, tags }>

  // Set only when this score was forked from a score linked into this project
  // (§5.3). `revisionId` is the source's latest revision at fork time.
  forkedFrom?: { scoreId: string, revisionId: string, projectId: string }

  // Server-maintained publication marker — see 2.2.1. Never client-written.
  published: { revisionId: string, songbookIds: string[] } | null
}
```

`scoreId` is derived from revision 1 (`${projectId}-${slugify(title)}`) and is
**immutable for the lifetime of the score** — URLs and songbook pins depend on it.
Renames in later revisions do not change it.

**Display metadata resolution order:** `metadataOverride[f] ?? cachedMetadata[f]`.

#### 2.2.1 `published` marker

Answers "is this score public, and at which revision?" with one read, instead of
searching songbooks for pins. Maintained by a Cloud Function (`syncPublishedScores`),
not by clients: a songbook can pin a *linked* score owned by another project, whose
container the songbook's admins must not be able to write.

- `songbookIds` — published, live songbooks of live projects whose current revision
  pins this score.
- `revisionId` — the pin from the most recently created of those songbook revisions.
- `null` when no such songbook exists, or when the score or its project is
  soft-deleted.

**Triggers** (`onDocumentWritten`):

| Document | When | Recompute |
|---|---|---|
| `songbooks/{id}` | `currentRevisionId`, `isPublished` or `deletedAt` changed | scores pinned by the old and new current revisions |
| `scores/{id}` | `deletedAt` changed | that score |
| `projects/{id}` | `deletedAt` changed | scores pinned by the project's songbooks, plus the project's own scores |

Recomputing a score reads its candidate songbooks (`published.songbookIds` ∪ the
songbook that triggered) and their current revisions, so it is idempotent and
order-independent. A `scripts/rebuildPublishedScores.ts` performs the same
computation over everything, for migrations (M5, M7) and drift repair.

**Eventually consistent:** a publish or re-pin shows up on the homepage a few seconds
later. Acceptable — publishing is rare and owner-driven.

### 2.3 `scores/{scoreId}/scoreRevisions/{revisionId}`

```ts
{
  revisionNumber: number       // display only; = prev.revisionNumber + 1
  prevRevisionId: string | null   // NEW — the linked list
  slug: string                 // NEW — `${slugify(title)}-${YYYYMMDDTHHmmss}`
  uploadedBy: uid
  uploadedAt: Timestamp

  metadata: { title, composer, sub, tags }   // NEW — extracted from the mscz/metajson

  mscz: StorageFile
  metajson: StorageFile
  midi: StorageFile
  parts: PartData[]
  notes: string

  origin:
    | { type: "upload" }
    | { type: "fork", sourceScoreId, sourceRevisionId, sourceProjectId }
}
```

`revisionId` is `${slugify(metadata.title)}-${YYYYMMDDTHHmmss}-${rand4}`.
Rationale: today's `String(getScoreRevisions().length + 1)` (`uploadScore.ts:50`)
is racy — two concurrent uploads compute the same id and one silently overwrites
the other. Timestamp ids cannot collide across writers.

**Existing revisions keep their ids** (`"1"`, `"2"`, …). Their storage paths and
`/score/:scoreId/:revisionId` URLs depend on them; only new revisions use the new
format. Code must not assume either format.

#### 2.3.1 Immutability

Revisions are never deleted and never edited — no exceptions. The legacy `isLatest`
field existed only for the `collectionGroup("revisions")` query that builds today's
homepage; the homepage is now built from published songbooks' pins (§4.4), which
name revisions directly, so the new shape drops it. "Latest" is always
`scores/{id}.latestRevisionId`. (`isLatest` is still dual-written to the legacy
`revisions` doc until M9, §0.)

Metadata typos are fixed via `scores/{id}.metadataOverride`, never by editing a
revision. This keeps every revision's metadata a faithful record of its mscz.

### 2.4 `scores/{scoreId}/scoreRevisions/{revisionId}/comments/{commentId}`

```ts
{
  authorId: uid
  body: string
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null

  anchor: {
    partName: string     // matches RevisionDoc.parts[].name
    page: number         // 1-based index into parts[].svg
    x?: number           // optional normalized 0..1 pin position on the SVG
    y?: number
  }

  parentId: string | null   // null = thread root; else a reply
}
```

**There is no resolve/solved state.** Comments are anchored to one specific score
revision and are never carried over to the next one (§5.4). Uploading a new revision
*is* the act of addressing them: revision N's comment thread stays attached to
revision N as a historical record, and revision N+1 starts with a clean slate. A
manual "mark as solved" flag would duplicate that signal.

> Deviation from `REQUIREMENTS.md`, which states *"REVIEW_COMMENTS can be marked as
> solved"*. Deliberately overridden — revision-scoped comments make the flag
> redundant. Revisit if reviewers end up wanting to close a thread without a new
> revision being uploaded.

Any REVIEWER+ may comment and reply. Authors may edit/soft-delete their own
comments.

A comment subcollection under an immutable revision doc does not violate
immutability — the revision document itself is untouched.

### 2.5 `songbooks/{songbookId}` (container)

```ts
{
  title: string
  projectId: string
  slug: string                    // unique within project; public URL segment
  currentRevisionId: string
  isPublished: boolean            // orthogonal to revisions — see 4.4
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null     // NEW
}
```

Deleting a songbook does **not** touch its scores (explicit requirement).

### 2.6 `songbooks/{songbookId}/songbookRevisions/{revisionId}`

```ts
{
  revisionNumber: number
  prevRevisionId: string | null
  createdBy: uid
  createdAt: Timestamp
  note: string                    // freeform changelog line

  // Structure: which scores, in what order, under which sections, with which
  // index numbers. ADMIN-only to change.
  entries: SongbookEntry[]

  // Which revision of each score is pinned. EDITOR-changeable.
  pins: Record<scoreId, revisionId>

  // Per-instrument cover image. ADMIN-only to change.
  covers: Record<Instrument, StorageFile>
}

type SongbookEntry =
  | { type: "section", title: string, order: number }
  | { type: "score", scoreId: string, order: number, index: number }
```

Three changes from today's `zSongbookEntry`:

1. **Pins are split out of `entries` into their own map.** This is what makes the
   admin/editor split enforceable in security rules: an editor's write must leave
   `entries` and `covers` byte-identical to the previous revision and may only
   differ in `pins` (§4.3, §5.5). Rules cannot diff a list element-wise, so keeping
   `revisionId` inside `entries` would have made the restriction UI-only.
2. **`revisionId` is always a concrete id.** The magic value `"latest"`
   (`types/docs.ts`, `zSongbookScoreRef`) is removed — it is incompatible with a
   reproducible artifact.
3. **`index` is persisted.** Today the number is derived from iteration order at
   render time (`createSongBook.ts:196` — *"Always advance the index number for
   consistent numbering"*), so it silently shifts if entries are reordered between
   two instrument exports. Freezing it in the revision is what actually guarantees
   the requirement that all INSTRUMENT_SONGBOOKs share numbering.

`index` is assigned over `type === "score"` entries in `order` sequence at revision
creation; sections do not consume a number.

**Constraint introduced by keying `pins` on `scoreId`:** a score can appear at most
once in a songbook. Intended, but stated explicitly since the old `entries` shape
did not enforce it.

#### 2.6.1 Stale-pin detection

A songbook revision pins exact score revisions. When rendering the songbook UI,
for each entry compare `pins[scoreId]` against `scores/{scoreId}.latestRevisionId`;
if different, show a "newer revision available" badge. EDITOR+ can bump one entry
or all stale entries — either action creates a **new songbook revision** with the
same `entries`/`covers` and an updated `pins`. Non-editors see the badge but cannot
act. Nothing auto-updates.

### 2.7 Cover images

Covers are per-INSTRUMENT_SONGBOOK and live in the songbook revision, because the
rendered PDF depends on them — a cover change must produce a new, distinguishable
artifact.

**Bulk upload UI** (mirrors the existing per-instrument picker in
`PdfGenerator.tsx:99-125`): accept a multi-file drop, parse the instrument from
each filename via `parseInstrument` (`src/instrument.ts`, already used by
`parseUploadedFiles`), and map `capa-trompete.png → covers["trompete"]`. Unmatched
filenames surface as warnings using the existing `Warning` type from `src/result.ts`.
Covers are ADMIN-only. Uploading covers creates a new songbook revision with
`entries` and `pins` copied by value from the previous one.

---

## 3. Storage layout

```
scores/{scoreId}/{revisionId}/
  score.mscz
  score.metajson
  score.midi
  parts/{partName}.midi
  parts/{partName}-{n}.svg

songbooks/{songbookId}/{revisionId}/covers/{instrument}.{ext}

avatars/{uid}
```

> **Resolved on `main`.** Uploads write to `scores/` (13b0e43d), migration
> `202604201809_songs_to_scores` moves legacy objects, and `storage.rules` checks
> project roles with no `!exists()` escape hatch. Remaining: confirm the prod
> bucket has nothing left under `songs/` (task 000).

---

## 4. Permissions

### 4.1 Role capability matrix

Roles are cumulative: OWNER ⊃ ADMIN ⊃ EDITOR ⊃ REVIEWER.

| Capability | REVIEWER | EDITOR | ADMIN | OWNER |
|---|:--:|:--:|:--:|:--:|
| Read project scores & all their revisions | ✅ | ✅ | ✅ | ✅ |
| Read unpublished songbooks + full revision history | ✅ | ✅ | ✅ | ✅ |
| Create / reply to REVIEW_COMMENTs | ✅ | ✅ | ✅ | ✅ |
| Edit / soft-delete **own** comments | ✅ | ✅ | ✅ | ✅ |
| Create SCORE in project | ❌ | ✅ | ✅ | ✅ |
| Upload new SCORE_REVISION | ❌ | ✅ | ✅ | ✅ |
| Link / unlink another project's SCORE | ❌ | ✅ | ✅ | ✅ |
| Fork a linked SCORE (by uploading a revision to it, §5.3) | ❌ | ✅ | ✅ | ✅ |
| Re-pin a score's revision in a SONGBOOK (`pins` only) | ❌ | ✅ | ✅ | ✅ |
| Edit project title | ❌ | ✅ | ✅ | ✅ |
| Edit score `metadataOverride` | ❌ | ❌ | ✅ | ✅ |
| Create SONGBOOK; edit title/slug | ❌ | ❌ | ✅ | ✅ |
| Change songbook `entries` (add/remove/reorder/sections) | ❌ | ❌ | ✅ | ✅ |
| Change songbook `covers` | ❌ | ❌ | ✅ | ✅ |
| Invite members; assign EDITOR / REVIEWER | ❌ | ❌ | ✅ | ✅ |
| Soft-delete SCORE | ❌ | ❌ | ❌ | ✅ |
| Publish / unpublish SONGBOOK | ❌ | ❌ | ❌ | ✅ |
| Soft-delete SONGBOOK | ❌ | ❌ | ❌ | ✅ |
| Remove members; assign ADMIN; transfer OWNER | ❌ | ❌ | ❌ | ✅ |
| Soft-delete PROJECT | ❌ | ❌ | ❌ | ✅ |

Non-members: read published songbooks (current revision only), read any score +
score revision. They see no review UI (comments, counts). Linking and forking need
EDITOR+ on the *target* project only — no role in the source project.

### 4.2 Deltas from the deployed `firestore.rules`

| # | Today | Required |
|---|---|---|
| 1 | `scores` update ← EDITOR | metadata override ← ADMIN; EDITOR may only touch `latestRevisionId`/`cachedMetadata` via revision creation |
| 2 | `scores` hard `delete` ← ADMIN | no hard delete; soft delete via `deletedAt` ← OWNER |
| 3 | `revisions` update ← EDITOR, any field | `scoreRevisions` immutable (no `isLatest`, §2.3.1); legacy `revisions` keeps today's rule until M9 for dual-writes |
| 4 | `songbooks` update ← EDITOR (incl. `isPublished`) | `isPublished` ← OWNER only |
| 5 | `songbooks` hard `delete` ← ADMIN | soft delete ← OWNER |
| 6 | `projects.members` map writable by ADMIN, unrestricted | map moves to `projects/{pid}/members/{uid}`; ADMIN may only grant `editor`/`reviewer`; `admin`/`owner` grants and removal ← OWNER |
| 7 | `projects` hard `delete` ← OWNER | soft delete ← OWNER |
| 8 | unpublished songbook read ← any member | unchanged ✅ |
| 9 | published songbook — all revisions readable | non-members: `currentRevisionId` only |
| 10 | no rules for `comments` | added (no resolve state — §2.4) |
| 11 | `storage.rules` reads the `projects.members` map | rewrite against `members/{uid}` docs; add `songbooks/**` match |
| 12 | ~~`storage.rules` path vs. upload path~~ | resolved on `main` (§3) |
| 14 | invitation acceptance is **denied** — invitee has no role, so the `projects` update rule rejects it | invitations move to `projects/{pid}/invitations/{uid}`; invitee creates their own member doc, rule verifies the invitation; project rule lets the invitee add only themselves to `memberIds` (§2.1.2) |
| 15 | `match /{path=**}/revisions/{id}` world-readable | kept for legacy `revisions` until M9, then removed; `scoreRevisions` needs no collection-group rule; songbook revisions use `songbookRevisions` so they are never swept in (§1) |
| 16 | invite-by-email queries `users`, which rules deny (and nothing writes) | invite by username via callable function `findUserForInvite` (§2.1.2) |
| 17 | no collection-group rule for invitations | added, invitee-only (`toUserId == auth.uid`) |
| 18 | owner may demote/remove themselves | owner may not write or delete **their own** member doc; ownership transfer is a deferred admin-panel operation (§8) |
| 19 | no score links | `projects/{pid}/scoreLinks/{scoreId}` ← EDITOR+ of `pid`, only for scores of other projects; fork containers must name a live link (§2.1.3, §5.3) |
| 20 | no publication state on scores | `scores.published` written only by the `syncPublishedScores` function (admin SDK, bypasses rules); no client clause may touch it (§2.2.1) |

### 4.3 Rules sketch

```js
function project(pid) { return get(/databases/$(db)/documents/projects/$(pid)).data; }
function alive(pid)   { return project(pid).deletedAt == null; }

// get() returns null for a missing document, and identical get() calls are
// deduplicated within one request — so this is a single document access.
// Returns 'none' for non-members, making the predicates below safe to call
// unauthenticated.
function memberDoc(pid) {
  return get(/databases/$(db)/documents/projects/$(pid)/members/$(request.auth.uid));
}
function role(pid) {
  return request.auth == null || memberDoc(pid) == null
    ? 'none' : memberDoc(pid).data.role;
}

function isReviewer(pid) { return alive(pid) && role(pid) in ['owner','admin','editor','reviewer']; }
function isEditor(pid)   { return alive(pid) && role(pid) in ['owner','admin','editor']; }
function isAdmin(pid)    { return alive(pid) && role(pid) in ['owner','admin']; }
function isOwner(pid)    { return alive(pid) && role(pid) == 'owner'; }

function changed(fields) {
  return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields);
}

function scoreProject(scoreId) {
  return get(/databases/$(db)/documents/scores/$(scoreId)).data.projectId;
}
function songbook(songbookId) {
  return get(/databases/$(db)/documents/songbooks/$(songbookId)).data;
}
function songbookProject(songbookId) { return songbook(songbookId).projectId; }

match /scores/{scoreId} {
  allow read: if true;
  allow create: if isEditor(request.resource.data.projectId)
                && request.resource.data.uploadedBy == request.auth.uid
                && request.resource.data.deletedAt == null
                && request.resource.data.published == null   // function-owned, 2.2.1
                // a fork must come from a score linked into the target project
                && (!('forkedFrom' in request.resource.data) ||
                    get(/databases/$(db)/documents/projects/$(request.resource.data.projectId)/scoreLinks/$(request.resource.data.forkedFrom.scoreId)).data.deletedAt == null);
  allow update: if
    // new revision: editor bumps pointer + cache
    (isEditor(resource.data.projectId) && changed(['latestRevisionId','cachedMetadata'])) ||
    // failed first upload: the creator abandons a score that never got a revision
    (isEditor(resource.data.projectId) && resource.data.uploadedBy == request.auth.uid
      && resource.data.latestRevisionId == '' && changed(['deletedAt'])) ||
    // metadata correction: admin only
    (isAdmin(resource.data.projectId)  && changed(['metadataOverride'])) ||
    // soft delete / restore: owner only
    (isOwner(resource.data.projectId)  && changed(['deletedAt']));
  allow delete: if false;   // soft deletes only

  match /scoreRevisions/{revisionId} {
    allow read: if true;
    allow create: if isEditor(scoreProject(scoreId))
                  && request.resource.data.uploadedBy == request.auth.uid;
    allow update, delete: if false;   // immutable, §2.3.1

    match /comments/{commentId} {
      allow read:   if isReviewer(scoreProject(scoreId));
      allow create: if isReviewer(scoreProject(scoreId))
                    && request.resource.data.authorId == request.auth.uid;
      // authors edit / soft-delete their own; nobody else writes
      allow update: if resource.data.authorId == request.auth.uid
                    && changed(['body','updatedAt','deletedAt']);
      allow delete: if false;
    }
  }
}

match /songbooks/{songbookId} {
  allow read: if (resource.data.isPublished == true && resource.data.deletedAt == null)
              || isReviewer(resource.data.projectId);
  allow create: if isAdmin(request.resource.data.projectId);
  allow update: if
    // the new pointer must name a revision committed in the same batch
    (isEditor(resource.data.projectId) && changed(['currentRevisionId','updatedAt'])
      && existsAfter(/databases/$(db)/documents/songbooks/$(songbookId)/songbookRevisions/$(request.resource.data.currentRevisionId))) ||
    (isAdmin(resource.data.projectId)  && changed(['title','slug','updatedAt']))     ||
    (isOwner(resource.data.projectId)  && changed(['isPublished','deletedAt','updatedAt']));
  allow delete: if false;

  match /songbookRevisions/{revisionId} {
    // non-members see only the revision the container currently points at
    allow read: if isReviewer(songbookProject(songbookId)) || (
      songbook(songbookId).isPublished == true &&
      songbook(songbookId).deletedAt == null &&
      songbook(songbookId).currentRevisionId == revisionId
    );
    // Admins may create any revision. Editors may only re-pin: `entries` and
    // `covers` must be byte-identical to the previous revision, leaving `pins`
    // as the only thing they can change. This is exactly why pins were split
    // out of `entries` in 2.6 — rules cannot diff a list element-wise.
    // `prevRevisionId` must be the *current* revision: otherwise an editor could
    // name an older revision and roll back an admin's entries/covers.
    allow create: if request.resource.data.createdBy == request.auth.uid && (
      isAdmin(songbookProject(songbookId)) || (
        isEditor(songbookProject(songbookId)) &&
        request.resource.data.prevRevisionId == songbook(songbookId).currentRevisionId &&
        request.resource.data.entries == prevSbRev(songbookId).entries &&
        request.resource.data.covers  == prevSbRev(songbookId).covers
      ));
    allow update, delete: if false;
  }
}

match /projects/{pid} {
  allow read: if true;
  // The creator's owner member doc is written in the same batch; see 5.0.
  allow create: if request.auth != null
                && request.resource.data.memberIds == [request.auth.uid]
                && request.resource.data.deletedAt == null;
  allow update: if
    (isEditor(pid) && changed(['title'])) ||
    // memberIds is a query index only — admins keep it in sync, it grants nothing
    (isAdmin(pid) && changed(['memberIds'])) ||
    // invitee accepting: may add exactly themselves, alongside their member doc
    (request.auth != null && changed(['memberIds'])
      && request.resource.data.memberIds.toSet().difference(resource.data.memberIds.toSet())
           == [request.auth.uid].toSet()
      && resource.data.memberIds.toSet().difference(request.resource.data.memberIds.toSet()).size() == 0
      && existsAfter(/databases/$(db)/documents/projects/$(pid)/members/$(request.auth.uid))) ||
    isOwner(pid);                    // incl. deletedAt
  allow delete: if false;

  match /members/{uid} {
    allow read: if true;             // displayName only — no email (§2.1.1)
    allow create, update: if
      // Bootstrap: project creator writes their own owner doc. The project is
      // created in the same batch, so rules must read post-commit state —
      // get() would see the pre-batch world, where the project does not exist.
      (uid == request.auth.uid && request.resource.data.role == 'owner'
        && !exists(/databases/$(db)/documents/projects/$(pid)/members/$(uid))
        && getAfter(/databases/$(db)/documents/projects/$(pid)).data.memberIds == [uid]) ||
      // owner does anything — except to their own doc, so a project can never
      // be left without an owner
      (isOwner(pid) && uid != request.auth.uid) ||
      // admin grants editor/reviewer, and may not touch an admin or owner
      (isAdmin(pid)
        && request.resource.data.role in ['editor', 'reviewer']
        && (!exists(/databases/$(db)/documents/projects/$(pid)/members/$(uid))
            || resource.data.role in ['editor', 'reviewer'])) ||
      // invitee accepts: creates their own doc at the invited role
      (uid == request.auth.uid
        && !exists(/databases/$(db)/documents/projects/$(pid)/members/$(uid))
        && invitation(pid, uid).accepted == null
        && invitation(pid, uid).deletedAt == null
        && invitation(pid, uid).role == request.resource.data.role);
    allow delete: if isOwner(pid) && uid != request.auth.uid;
  }

  match /scoreLinks/{scoreId} {
    allow read: if true;
    allow create, update: if isEditor(pid)
                  && request.resource.data.scoreId == scoreId
                  && request.resource.data.sourceProjectId == scoreProject(scoreId)
                  && request.resource.data.sourceProjectId != pid;
    allow delete: if false;   // unlink = deletedAt
  }

  match /invitations/{uid} {
    allow read: if uid == request.auth.uid || isAdmin(pid);
    allow create, update: if isAdmin(pid)
                  && request.resource.data.role in ['editor', 'reviewer']
                  && request.resource.data.toUserId == uid
                  && request.resource.data.projectId == pid
                  && request.resource.data.fromUserId == request.auth.uid
                  && request.resource.data.accepted == null;
    // invitee accepts/denies (re-invite and admin cancel are covered above / below)
    allow update: if uid == request.auth.uid
                  && changed(['accepted','updatedAt','deletedAt']);
    allow update: if isAdmin(pid) && changed(['deletedAt','updatedAt']);
    allow delete: if false;
  }
}

// "My pending invitations" across projects.
match /{path=**}/invitations/{uid} {
  allow read: if request.auth != null && resource.data.toUserId == request.auth.uid;
}

function invitation(pid, uid) {
  return get(/databases/$(db)/documents/projects/$(pid)/invitations/$(uid)).data;
}

function prevSbRev(songbookId) {
  return get(/databases/$(db)/documents/songbooks/$(songbookId)/songbookRevisions/$(request.resource.data.prevRevisionId)).data;
}
```

The sketch is a starting point, not a deliverable; every clause gets a rules unit
test (§9, each slice) before it is deployed.

> Cost note: the editor-cover-preservation check costs one extra `get()` per
> songbook revision create. Acceptable at our write volume.

### 4.3.1 Member management

The uid is in the document path, so rules read it directly — no declaration, no
`lastMemberChange`, and member changes batch freely because each document is
validated on its own.

| Actor | May write | Blocked from |
|---|---|---|
| OWNER | any member doc but their own; delete members | changing or deleting their own doc (a project always keeps an owner) |
| ADMIN | create/update a member at `editor` or `reviewer` | granting `admin`/`owner`; touching anyone already `admin`/`owner`; deleting members |
| INVITEE | creating **their own** member doc, at exactly the role their pending invitation names | any other uid; any other role |
| creator | their own `owner` doc, only while creating the project | — |

The invitee clause is what makes invitation acceptance work at all; see the bug
note in §2.1.2.

`memberIds` on the project doc is maintained alongside these writes as a query
index and grants nothing (§2.1.1).

### 4.4 Publishing

Publishing is **orthogonal to revisions**. `songbooks.isPublished` makes the current
revision readable by non-members. It does not create a revision, and unpublishing
does not roll anything back. Only OWNER may toggle it.

Songbooks are the only publishable entity, and **the homepage is defined by them**:
it lists exactly the scores pinned by the current revision of every published,
live songbook of a live project. Scores outside any published songbook are not
listed (they stay reachable by URL and on their project's page for members).

The **project page** (`/projects/:slug`) follows the same rule. Non-members see only
the project's published songbooks; members also see all its own and linked scores
and its unpublished songbooks.

Homepage loading (`CollectionContext`), via the `published` marker (§2.2.1):

1. `scores where published != null`.
2. `get` each `published.revisionId` revision (parts).

**Public views show the published revision, not the latest.** A score's latest
revision may be an unreviewed upload; the published one is what the project put
out. Search results link to `/score/:scoreId/:publishedRevisionId`, and a
non-member opening `/score/:scoreId` gets `published.revisionId` by default (latest
if unpublished). Members default to the latest.

Cost is 1 query + N reads per load (N listed scores), less than today's
full-collection load.

Scores themselves are not gated: `scores` and their revisions stay world-readable,
which public songbook PDFs, links (§2.1.3) and forks (§5.3) all rely on.

### 4.5 Storage rules (rewrite)

```js
function scoreProject(scoreId) {
  return firestore.get(/databases/(default)/documents/scores/$(scoreId)).data.projectId;
}
function role(pid) {
  return firestore.get(/databases/(default)/documents/projects/$(pid)/members/$(request.auth.uid)).data.role;
}

// The client creates the score doc before uploading any blob (§5.1), so this
// always resolves — including on a first revision.
match /scores/{scoreId}/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null &&
    role(scoreProject(scoreId)) in ['owner','admin','editor'];
}

match /songbooks/{songbookId}/{allPaths=**} {
  allow read: if true;   // covers are only meaningful alongside a readable songbook
  allow write: if request.auth != null &&
    role(firestore.get(/databases/(default)/documents/songbooks/$(songbookId)).data.projectId)
      in ['owner','admin'];
}

match /avatars/{uid} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid;
}

match /{allPaths=**} { allow read, write: if false; }
```

The `!firestore.exists(...)` escape hatch and the score-doc-first upload order
already landed on `main` (6f3fa242); what remains is reading roles from member
docs and the `songbooks/**` match.

---

## 5. Flows

### 5.0 Create a PROJECT

One `writeBatch`, two documents:

```ts
const batch = writeBatch(db);
batch.set(projectRef(slug), {
  title, slug, memberIds: [user.uid], deletedAt: null,
  createdAt: serverTimestamp(),
});
batch.set(doc(db, "projects", slug, "members", user.uid), {
  uid: user.uid, role: "owner",
  displayName: user.displayName,
  addedBy: user.uid, addedAt: serverTimestamp(),
});
await batch.commit();
```

The member rule validates this with `getAfter()` on the project, since `get()`
would evaluate against the pre-batch state where the project does not yet exist.

### 5.1 Upload a new SCORE (EDITOR+)

1. Parse files client-side (`parseUploadedFiles`) → `metadata`, `parts`, `fileMap`.
2. Compute `scoreId = ${projectId}-${slugify(metadata.title)}`; reject if taken by
   a live score (offer "upload as new revision" instead).
3. **Create the `scores/{scoreId}` doc first** with `latestRevisionId: ""` —
   required so storage rules can resolve `projectId` (see §4.5).
4. Upload blobs to `scores/{scoreId}/{revisionId}/…`.
5. Transaction: create revision (`prevRevisionId: null`, `revisionNumber: 1`,
   `origin: {type:"upload"}`) + update container
   (`latestRevisionId`, `cachedMetadata`).
6. On failure, the creator soft-deletes the container. Rules allow this only while
   `latestRevisionId == ""` and only to `uploadedBy` (§4.3) — otherwise an EDITOR's
   cleanup would be denied by the owner-only `deletedAt` clause.

### 5.2 Upload a new SCORE_REVISION (EDITOR+)

Same, but inside the transaction: read container `latestRevisionId` → that becomes
`prevRevisionId`; `revisionNumber = prev.revisionNumber + 1`. The transaction is what removes today's race in
`uploadScore.ts:50`. `cachedMetadata` is refreshed from the new upload — fixing the
current silent-discard bug where re-uploading never updates title/composer/tags.

### 5.3 Links and forks (EDITOR+ of the target project)

There is no "fork" button on the website. Forking is a side effect of uploading a
new revision to a score the project only *links* to, and it happens in the export
app.

**Linking (web).** From a score page or search result, "Adicionar ao projeto" lists
projects where the user is EDITOR+ (excluding the score's own project); picking one
writes `projects/{pid}/scoreLinks/{scoreId}` (§2.1.3). The linked score now shows in
that project and can be put in its songbooks. Unlinking soft-deletes the link.

**Forking (export app).** The upload step resolves the exported score against the
chosen target project:

| Match in target project | Outcome |
|---|---|
| own score with the derived `scoreId` | new revision (§5.2) |
| a **linked** score whose resolved title slugifies to the same slug | **fork** — confirmation required |
| neither | new score (§5.1) |

The fork confirmation states plainly that the source belongs to another project,
that a new score will be created under the user's project, and that the link will be
replaced by it. The user may instead choose "criar como partitura nova", which
uploads without lineage.

On confirmation:

1. Create the container `scores/{targetProjectId}-{slugify(title)}` with
   `forkedFrom: { scoreId, revisionId: source.latestRevisionId, projectId }`
   (rules require a live link to `forkedFrom.scoreId`, §4.3).
2. Upload blobs under the fork's own prefix and create revision 1 as in §5.1, with
   `origin: { type: "fork", sourceScoreId, sourceRevisionId, sourceProjectId }`.
3. Soft-delete the link in the same batch as the container update.

**Nothing is shared with the source.** The uploaded files *are* revision 1, so a fork
never references another score's blobs — no cross-score storage dependency, and
purging (§8) needs no fork check. `sourceRevisionId` records the source's latest
revision at fork time; the export app cannot know which revision the user actually
edited from.

**Songbooks keep pointing at the source.** The target project's songbooks may still
pin the source score. They are not rewritten automatically (that would be an editor
changing `entries`, §5.5); instead the songbook view shows a "derivação disponível
neste projeto" badge on such entries, and an ADMIN can swap the entry to the fork in
one action — a new songbook revision with the same `order`/`index`, new `scoreId` and
pin.

Lineage is traceable in both directions: `origin` on the revision (per the
requirement that "its REVISION object should trace its lineage back") and
`forkedFrom` on the container for cheap list-view display.

### 5.4 Review comments

Comments are placed on the revision page, anchored to a `(partName, page)` pair —
i.e. on a specific rendered SVG. The UI overlays existing pins on the SVG in
`ScoreDisplay`; clicking an empty spot starts a new thread at that normalized
`(x, y)`. Positional pins ship in v1, not as a follow-up.

**Comments never carry over between revisions** — not by copy, and not by reference.
A comment's anchor names a part and page of *that revision's* SVGs, which the next
revision may not even have. Each revision therefore starts with an empty comment
thread, and revision N's comments remain readable on revision N's page as history.

This is why there is no resolve/solved state (§2.4): the review loop closes when an
editor uploads a new revision, and that event is already recorded in the revision
chain. A separate flag would be a second, desynchronisable source of truth.

Surfacing: the revision list shows a comment count per revision, and the score page
shows the count for its latest revision — which, because counts never carry over, is
directly readable as "open feedback on the current state".

Any REVIEWER+ comments and replies; authors edit or soft-delete their own. The whole
review UI — pins, threads, counts — renders only for members of the score's project;
non-members see the plain score page.

### 5.5 Songbook editing

Every mutation of `entries`, `pins`, or `covers` creates a **new songbook revision**
(copy-on-write; all three are small, so this is cheap) and advances
`currentRevisionId` in the same transaction. The revision list is the songbook's
history and is member-only.

Who may change what:

| Field | ADMIN+ | EDITOR |
|---|:--:|:--:|
| `entries` — add/remove scores, reorder, sections | ✅ | ❌ |
| `pins` — which revision of a score is used | ✅ | ✅ |
| `covers` | ✅ | ❌ |
| songbook `title` / `slug` (container) | ✅ | ❌ |
| creating the songbook itself | ✅ | ❌ |

An EDITOR's songbook work is therefore exactly: keep the pinned revisions current
(and upload the score revisions they point at). Enforced in rules by requiring an
editor-authored revision to carry `entries` and `covers` identical to its
predecessor (§4.3).

Index numbers are reassigned across `type === "score"` entries in `order` sequence
at revision creation and then frozen — so an editor re-pin never renumbers anything,
since `entries` is untouched by construction.

### 5.6 INSTRUMENT_SONGBOOK generation

Client-side, unchanged from today (`PdfGenerator.tsx` + `createSongBook.ts`), but
driven by a persisted songbook revision rather than in-memory builder state:

- entries and their frozen `index` come from the revision — `createSongBook` stops
  computing numbering itself;
- covers come from `revision.covers[instrument]`;
- generated PDFs are **not** stored (see §8).

Available on the public `/songbooks/:projectSlug/:songbookSlug` page for published
songbooks, and to members for unpublished ones.

### 5.7 Deleted scores inside a songbook

A songbook revision pins `scoreId`s, and a score can be soft-deleted after the
revision was created. The pin is never silently dropped — index numbers must stay
stable across every INSTRUMENT_SONGBOOK.

Rendering rules for an entry whose score (`entries[].scoreId`) has
`deletedAt != null`:

| Surface | Behaviour |
|---|---|
| Index page | entry keeps its `index` number; title rendered **struck through** |
| Score pages | **omitted** — no blank placeholder pages are emitted |
| Page numbering | continues uninterrupted; the omitted score contributes no pages |
| Songbook front matter | a marker noting that one or more scores were removed |
| Web songbook view | same: struck-through row, not clickable, with the marker |

Net effect: the numbering a musician has memorised stays correct, the removed piece
is visibly accounted for rather than mysteriously absent, and no paper is wasted on
placeholder pages.

`createSongBook` needs a `deleted: boolean` flag per `SectionScore` to drive the
strikethrough and the page skip; the marker is a render-time computation
(`entries.some(e => deleted)`).

To actually remove the entry from the songbook, an EDITOR creates a new songbook
revision without it — at which point the remaining entries renumber.

---

## 6. Soft deletes

Every entity except SCORE_REVISION and SONGBOOK_REVISION carries
`deletedAt: Timestamp | null`. No collection allows a hard `delete`. Revisions are
never deleted at all — they are the linked list's backbone.

Cascade semantics:

| Deleting | Effect |
|---|---|
| PROJECT | project hidden; its scores and songbooks become inaccessible (rules check `alive(pid)`) and drop off the homepage (`CollectionContext` filters by live project ids); no per-doc writes; **member documents are retained** so an owner can restore with roles intact |
| SCORE | score hidden from homepage, project lists and search; blobs are **never** removed (songbook revisions still pin it); songbook entries pinning it render struck-through per §5.7; links to it in other projects render as removed |
| SONGBOOK | songbook hidden; **scores untouched** (explicit requirement) |
| MEMBER removal | membership only; authored content untouched |

All read paths must filter `deletedAt`. Today only `getProjectScores` /
`getUserScores` do — `getAllScores` and `getLatestRevisions` do not, and
`CollectionContext` filters in application code instead. Both of those go away with
the songbook-driven homepage (§4.4).

---

## 7. Migration

Sequenced; each step is a script under `scripts/migrations/` following the existing
`Migration` interface with dry-run support. Each migration ships with the slice that
needs it (§9) — not as a block at the end.

| # | Migration | Slice | Notes |
|---|---|---|---|
| M0 | Storage path audit — nothing left under `songs/**` | 000 | `202604201809_songs_to_scores` exists; confirm it ran in prod |
| M2 | Rename `Revision` → `ScoreRevision` in code | 000 | pure refactor, no data change |
| M2b | Copy `scores/*/revisions/*` → `scores/*/scoreRevisions/*` | 000 | same ids, `isLatest` dropped; old subcollection kept (and dual-written, §0) until M9 |
| M1 | Backfill `deletedAt: null` on projects, songbooks | 001 | |
| M1b | `projects.members` map → `projects/{pid}/members/{uid}` docs | 001 | one doc per entry; denormalize `displayName` from `users/{uid}` (admin credentials); keep `memberIds`; map dropped in M9 |
| M1c | `invitations/{autoId}` → `projects/{pid}/invitations/{uid}` | 001 | keep the newest pending invitation per (project, user); fill the denormalized display fields |
| M3 | Add `prevRevisionId` + `slug` + `origin` to existing revisions | 002 | order by `revisionNumber`; `origin: {type:"upload"}` for all |
| M4 | Move metadata onto revisions | 002 | copy `scores.{title,composer,sub,tags}` → every revision's `metadata`; write `cachedMetadata` and `published: null`; legacy top-level fields kept until M9 (flag-off code reads them) |
| M5 | Songbook containers → container + revision 1 | 004 | split `entries` into `entries` + `pins`; assign `index`; resolve `revisionId === "latest"` to the concrete `latestRevisionId`; then `rebuildPublishedScores` |
| M6 | Identify the four PROJECTS — carnaval, garota, na tora, besourinhos | 007 | confirm which already exist; all owned by the CADERNIN uid |
| M7 | Build SONGBOOKS per project-year | 007 | carnaval via `generateCarnivalSections`; others via `generateSectionsByStyle` (`src/utils/songBookRows.ts`); reorder manually; created with `isPublished: true`; pins = each score's latest revision. Since the homepage becomes songbook-driven, the dry run reports every score on today's homepage that no published songbook pins — those disappear at launch unless placed somewhere; then `rebuildPublishedScores` |
| M9 | Drop legacy data: score-level metadata, `projects.members` map, top-level `invitations`, `scores/*/revisions` (and its collection-group rule); stop dual-writing | 007 | only after the flag is on in prod and the old code paths are deleted |

There is no separate "deploy rules" step: each slice deploys its own rules (§0).

**Nice-to-have (not blocking):** a script that reads index pages from PDFs
previously generated by cadernin and reconstructs songbook entries + ordering,
to avoid hand-rebuilding M7.

### 7.1 The CADERNIN account

CADERNIN is an ordinary Firebase Auth user, referenced today only by
`VITE_CADERNIN_UID` in `CollectionContext.tsx:30`. Two things ride on it:

1. **Credentials** — a shared password. Whoever holds it is OWNER of all four
   migrated projects. No per-person revocation; every migrated score carries
   `uploadedBy: <cadernin uid>`, so revision history cannot attribute uploads.
   With no ownership-transfer UI, losing the password loses owner access.
2. **Member lists** — it appears in `ProjectSettingsPage` as a normal member.

**Decision: keep it a normal user (no org entity).** Introducing `orgs/{orgId}`
with its own membership would add a second ownership axis to every rule for no
near-term gain.

**The homepage is driven by published songbooks (§4.4), not by ownership.**
Despite appearances, the uid filter in `CollectionContext.tsx:30` never restricted
today's homepage: it only narrows the map used to look up project *titles*, and
every live score is listed regardless. Both the filter and `VITE_CADERNIN_UID` are
deleted with the flag-off code path.

Keying discovery on *published songbooks* rather than on *who owns the project*
means transferring the migrated projects to real human owners later is a pure
ownership change, and any project — not only CADERNIN's — gets on the homepage by
publishing a songbook.

Behaviour change at launch: scores no published songbook pins drop off the
homepage. M7's dry run lists them (§7).

(An earlier draft added `projects.isPublished` as a discovery flag. Dropped:
published songbooks already answer "what is public".)

---

## 8. Deferred / future improvements

- **Persisted INSTRUMENT_SONGBOOK artifacts.** Generate PDFs server-side per
  songbook revision, store at `songbooks/{id}/{revisionId}/pdfs/{instrument}.pdf`,
  serve stable links. Needed if generation time or client memory becomes a problem,
  or if we want byte-identical reproducibility.
- **Storage monitoring and per-user upload limits** (already in `TECH_DEBT.md`).
  Required before revision purging can be considered.
- **Revision purge policy.** Revisions are currently immortal. Revisit once storage
  monitoring exists. Any purge script must skip revisions pinned by any songbook
  revision. Forks never share blobs (§5.3), so they need no check.
- **Mutable score URL slug.** `scoreId` is frozen at revision 1, so a title typo
  corrected in revision 2 survives in the URL forever (display is unaffected —
  `cachedMetadata`/`metadataOverride` are correct everywhere). Fix would be a
  mutable `displaySlug` + `slugHistory[]` for redirects, resolved by query, with a
  `slugs/{projectId}--{slug}` reservation doc for uniqueness (rules cannot enforce
  field uniqueness). Deferred: renames are rare and this drags in the same
  reservation machinery as the displayName-collision item in `TECH_DEBT.md`.
- **Project ownership transfer UI** (already in `TECH_DEBT.md`). Prerequisite for
  moving migrated projects off the CADERNIN account (§7.1).
- **Comment notifications** (email / in-app).
- **Invites: username suggestions and email invites.** v1 invites by exact
  username (§2.1.2); add search-as-you-type over usernames, and invitations to an
  email address that resolve on sign-up.
- **cadern.in admin panel.** A cross-project operator surface, gated on a
  site-admin claim rather than a project role. Home for:
  - restoring soft-deleted projects / scores / songbooks (no restore UI ships in v1;
    until then restore is a console or script operation)
  - storage usage monitoring and per-user upload limits
  - running the revision purge once a policy exists
  - project ownership transfer

---

## 9. Task breakdown

Vertical slices, each shippable on its own behind `FEATURE_FLAG_COLLAB_FLOW`, each
carrying its own schema, migration, rules, rules tests and UI. Details in the
numbered files:

| # | Slice | Depends on |
|---|---|---|
| [000](000-foundations.md) | Foundations: flag rename, prod audit, emulator + rules tests, `ScoreRevision` rename | — |
| [001](001-members-invitations.md) | Members & invitations subcollections; fixes acceptance; invite by username | 000 |
| [002](002-score-revisions.md) | Score revision linked list, transactional upload, metadata cache/override | 000 |
| [003](003-soft-deletes.md) | Soft deletes for project / score; read-path filtering | 001, 002 |
| [004](004-songbooks.md) | Songbooks: persisted revisions, pins, covers, publishing, public page, songbook-driven homepage | 001, 002, 003 |
| [005](005-review-comments.md) | Review comments with positional pins | 001, 002 |
| [006](006-links-fork.md) | Score links (web) + fork-on-upload (export app) | 001, 002 |
| [007](007-data-migration.md) | Real projects + songbooks, legacy cleanup, flag on in prod | all |

001 and 002 are independent and can run in parallel; so can 005 and 006.

---

## 10. Open questions

None blocking. Things to watch rather than decide now:

- **Editor re-pin scope.** Editors can change `pins` but not `entries`, so an editor
  who wants a *new* score in a songbook must ask an admin. If that turns out to be a
  daily friction, the fix is a narrower admin capability, not loosening the rule.
- **No way to close a comment thread without a new revision.** Accepted consequence
  of dropping resolve (§2.4). If reviewers start asking for it, revisit.
- **`memberIds` can drift from the member documents** (§2.1.1). Harmless by
  construction — it is a query index and grants nothing — but a periodic
  reconciliation check in the admin panel (§8) would be cheap insurance.
- **Denormalized `displayName`s go stale** (member docs, invitations) if a user
  renames themselves. Acceptable for now; a Cloud Function fan-out would fix it, and
  the displayName-uniqueness item in `TECH_DEBT.md` already points at a function.
- **Owners cannot leave or demote themselves** (§4.3.1). Until ownership transfer
  exists (§8), a sole owner is stuck with the project.
- **Fork matching is by slugified title** (§5.3). A retitled export won't match its
  linked score and uploads as a new score. If that happens often, let the user pick
  the linked score explicitly in the export app.
- **Fork lineage is approximate** (§5.3). `sourceRevisionId` is the source's latest
  revision at fork time, not necessarily the one edited. Fix would be for exported
  `.metajson` to carry `scoreId`/`revisionId` of the downloaded revision.

---

## 11. Decision log

| Decision | Where |
|---|---|
| Whole milestone behind `FEATURE_FLAG_COLLAB_FLOW` (default off); rules + migration ship per slice | §0, §9 |
| Revision subcollections named `scoreRevisions` / `songbookRevisions`, so the public collection-group rule cannot expose songbook revisions | §1 |
| Members move to `projects/{pid}/members/{uid}`; `memberIds` kept as a query index only | §2.1.1 |
| Member docs denormalize `displayName` only — no email, since they are public | §2.1.1 |
| Invitations move to `projects/{pid}/invitations/{uid}`; invitee may add only themselves to `memberIds` | §2.1.2 |
| Invite by username (Auth `displayName`) via a callable function; `users` stays owner-readable | §2.1.2 |
| Display names come from Firebase Auth; nothing reads `users/{uid}` | §2.1.2 |
| `owner` is never granted; a project has exactly one owner | §4.3.1 |
| Owners cannot modify or delete their own member doc | §4.3.1 |
| `metadataOverride` kept as an admin layer over revision metadata | §2.2 |
| Existing revision ids kept; new ones are timestamp-based | §2.3 |
| Failed first upload: creator may soft-delete a score with no revision | §5.1 |
| Songbooks are the only publishable entity; no project publish flag | §4.4, §7.1 |
| Homepage lists scores pinned by published songbooks, at the pinned (published) revision; CADERNIN uid filter removed | §4.4, §7.1 |
| Project page shows non-members only published songbooks | §4.4 |
| `scores.published` marker maintained by a Cloud Function; homepage and score page read it instead of searching songbooks | §2.2.1, §4.4 |
| Non-members see the published revision by default; members the latest | §4.4 |
| Fork matching by slugified title and lineage at source's latest revision — good enough for v1 | §5.3, §10 |
| `isLatest` dropped; score revisions fully immutable | §2.3.1 |
| Until launch, uploads dual-write the legacy shape so exporter uploads reach flag-off prod | §0 |
| Projects use other projects' scores via links; no web fork button | §2.1.3, §5.3 |
| Fork = upload to a linked score from the export app, user-confirmed; uploaded files are revision 1, nothing shared with source | §5.3 |
| Songbooks are not rewritten on fork; admin swaps the entry via a badge | §5.3 |
| Review UI renders for project members only | §5.4 |
| Songbook entries pin exact score revisions; stale badge + editor bump | §2.6.1 |
| Editor songbook revisions must build on the current revision | §4.3 |
| INSTRUMENT_SONGBOOKs generated client-side, not persisted | §5.6, §8 |
| Deleted score in a songbook: keep index, strike title, omit pages, add marker | §5.7 |
| Comment positional pins ship in v1 | §5.4 |
| Reviewers get full read on unpublished songbooks incl. revision history | §4.1 |
| Project soft delete retains member docs, so restore keeps roles | §2.1, §6 |
| `scoreId` frozen at revision 1; mutable `displaySlug` deferred | §8 |
| CADERNIN stays a normal user | §7.1 |
| Migrated songbooks are published by default | §7 (M7) |
| Comments never carry over between revisions | §5.4 |
| No resolve/solved state — supersedes `REQUIREMENTS.md` | §2.4 |
| Only ADMIN creates songbooks and edits `entries`/`covers`; EDITOR re-pins only | §4.1, §5.5 |
| `pins` split out of `entries` so the admin/editor split is rules-enforceable | §2.6 |
| Restore UI deferred to a cadern.in admin panel | §8 |
| Revision purging deferred behind storage monitoring; must respect songbook pins | §8 |
