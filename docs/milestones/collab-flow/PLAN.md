# Collaborative Flow — Design Spec

Status: **draft, for iteration**. Derived from `REQUIREMENTS.md` and the
current implementation. Supersedes the data-model sections of `firebase.md`.

---

## 1. Entities

| Entity | Firestore location | Mutable? |
|---|---|---|
| USER | `users/{uid}` | yes |
| PROJECT | `projects/{projectSlug}` | yes |
| MEMBER | `projects/{projectSlug}/members/{uid}` | yes |
| SCORE (container) | `scores/{scoreId}` | yes |
| SCORE_REVISION | `scores/{scoreId}/revisions/{revisionId}` | **no** (except `isLatest`) |
| REVIEW_COMMENT | `scores/{scoreId}/revisions/{revisionId}/comments/{commentId}` | author edit / soft-delete only |
| SONGBOOK (container) | `songbooks/{songbookId}` | yes |
| SONGBOOK_REVISION | `songbooks/{songbookId}/revisions/{revisionId}` | **no** |
| INSTRUMENT_SONGBOOK | *not persisted* — derived artifact, generated client-side | n/a |
| INVITATION | `projects/{projectSlug}/invitations/{uid}` | yes |

Naming change (per open question): the codebase term `Revision` becomes
`ScoreRevision` throughout, so `SongbookRevision` is unambiguous.

### 1.1 Relationships

```
PROJECT ─┬─ members: {uid -> role}
         ├─ SCORES         (scores.projectId == project.slug)
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

  // Discovery flag: this project's scores appear on the homepage and in public
  // search. NOT an access control — score reads are public regardless (forking
  // requires it, 5.3). Owner-only toggle. See 7.1.
  isPublished: boolean           // NEW
}
```

**Changes:** add `deletedAt` and `isPublished`; **the `members` map moves to a
subcollection** (§2.1.1). Project deletion becomes a soft delete; the hard
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
  email: string

  addedBy: uid
  addedAt: Timestamp
}
```

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
batch.set(doc(db, "projects", pid, "members", uid), { uid, role, displayName, email, ... });
batch.update(projectRef(pid), { memberIds: arrayUnion(uid) });
await batch.commit();
```

### 2.1.2 `projects/{projectSlug}/invitations/{uid}`

```ts
{
  fromUserId: uid
  toUserId: uid            // == the document id
  role: "editor" | "reviewer"
  accepted: boolean | null
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}
```

Moved from the top-level `invitations/{autoId}` collection to a deterministic path,
keyed by invitee. This is what lets the invitee create their own member document:
the rule locates the invitation without being told where it is (§4.3). One pending
invitation per user per project — re-inviting overwrites.

> **Live bug this fixes.** `acceptUserProjectInvitation` (`src/lib/db.ts`)
> batch-updates `projects/{pid}.members` as the invitee. The invitee holds no role
> yet, so the deployed `projects` update rule evaluates `null in ['owner','admin']`
> → false and the write is denied. **Invitation acceptance does not work against the
> deployed rules**; it is masked by `FEATURE_FLAG_AUTH_ENABLED`. An auto-id
> invitation cannot be fixed in rules at all — the rule has no way to find the
> document — which is the same "cannot discover the key" limitation that drove the
> members change.

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

  // Set only when this score was forked from another project's score.
  forkedFrom?: { scoreId: string, revisionId: string, projectId: string }
}
```

`scoreId` is derived from revision 1 (`${projectId}-${slugify(title)}`) and is
**immutable for the lifetime of the score** — URLs and songbook pins depend on it.
Renames in later revisions do not change it.

**Display metadata resolution order:** `metadataOverride[f] ?? cachedMetadata[f]`.

### 2.3 `scores/{scoreId}/revisions/{revisionId}`

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

  isLatest: boolean            // mutable index field — see 2.3.1

  origin:
    | { type: "upload" }
    | { type: "fork", sourceScoreId, sourceRevisionId, sourceProjectId }
}
```

`revisionId` is `${slugify(metadata.title)}-${YYYYMMDDTHHmmss}-${rand4}`.
Rationale: today's `String(getScoreRevisions().length + 1)` (`uploadScore.ts:50`)
is racy — two concurrent uploads compute the same id and one silently overwrites
the other. Timestamp ids cannot collide across writers.

#### 2.3.1 Immutability

Revisions are never deleted and never edited, with **one documented exception**:
`isLatest`, which exists solely to serve the `collectionGroup("revisions")` query
in `getLatestRevisions()`. Security rules permit updating that single field and
nothing else. (Alternative considered: drop `isLatest` and denormalize `parts`
onto the container — rejected, `parts` is large and would double storage of the
hottest field.)

Metadata typos are fixed via `scores/{id}.metadataOverride`, never by editing a
revision. This keeps every revision's metadata a faithful record of its mscz.

### 2.4 `scores/{scoreId}/revisions/{revisionId}/comments/{commentId}`

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

### 2.6 `songbooks/{songbookId}/revisions/{revisionId}`

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

> **P0 bug.** `uploadScore.ts:55` writes to `songs/{scoreId}/{revisionId}`, while
> `storage.rules` only matches `/scores/{songId}/{allPaths=**}`. Everything under
> `songs/` falls through to the deny-all catch-all. Verify against the deployed
> bucket before anything else; migrate existing objects `songs/** → scores/**` or
> keep a compatibility match for legacy paths.

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
| Re-pin a score's revision in a SONGBOOK (`pins` only) | ❌ | ✅ | ✅ | ✅ |
| Edit project title | ❌ | ✅ | ✅ | ✅ |
| Edit score `metadataOverride` | ❌ | ❌ | ✅ | ✅ |
| Create SONGBOOK; edit title/slug | ❌ | ❌ | ✅ | ✅ |
| Change songbook `entries` (add/remove/reorder/sections) | ❌ | ❌ | ✅ | ✅ |
| Change songbook `covers` | ❌ | ❌ | ✅ | ✅ |
| Invite members; assign EDITOR / REVIEWER | ❌ | ❌ | ✅ | ✅ |
| Soft-delete SCORE | ❌ | ❌ | ❌ | ✅ |
| Publish / unpublish SONGBOOK | ❌ | ❌ | ❌ | ✅ |
| Publish / unpublish PROJECT (homepage discovery) | ❌ | ❌ | ❌ | ✅ |
| Soft-delete SONGBOOK | ❌ | ❌ | ❌ | ✅ |
| Remove members; assign ADMIN; transfer OWNER | ❌ | ❌ | ❌ | ✅ |
| Soft-delete PROJECT | ❌ | ❌ | ❌ | ✅ |

Non-members: read published songbooks (current revision only), read any score +
score revision, fork a score into a project where they are EDITOR+.

### 4.2 Deltas from the deployed `firestore.rules`

| # | Today | Required |
|---|---|---|
| 1 | `scores` update ← EDITOR | metadata override ← ADMIN; EDITOR may only touch `latestRevisionId`/`cachedMetadata` via revision creation |
| 2 | `scores` hard `delete` ← ADMIN | no hard delete; soft delete via `deletedAt` ← OWNER |
| 3 | `revisions` update ← EDITOR, any field | only `isLatest`, only by EDITOR+ |
| 4 | `songbooks` update ← EDITOR (incl. `isPublished`) | `isPublished` ← OWNER only |
| 5 | `songbooks` hard `delete` ← ADMIN | soft delete ← OWNER |
| 6 | `projects.members` map writable by ADMIN, unrestricted | map moves to `projects/{pid}/members/{uid}`; ADMIN may only grant `editor`/`reviewer`; `admin`/`owner` grants and removal ← OWNER |
| 7 | `projects` hard `delete` ← OWNER | soft delete ← OWNER |
| 8 | unpublished songbook read ← any member | unchanged ✅ |
| 9 | published songbook — all revisions readable | non-members: `currentRevisionId` only |
| 10 | no rules for `comments` | added (no resolve state — §2.4) |
| 13 | no `isPublished` on projects | added; owner-only; drives homepage discovery |
| 11 | `storage.rules` reads `project.ownerId` / `project.collaboratorIds` | **stale — fields no longer exist**; rewrite against `members` |
| 12 | `storage.rules` path `scores/**` vs. writes to `songs/**` | align (see §3) |
| 14 | invitation acceptance is **denied** — invitee has no role, so the `projects` update rule rejects it | invitations move to `projects/{pid}/invitations/{uid}`; invitee creates their own member doc, rule verifies the invitation (§2.1.2) |

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

match /scores/{scoreId} {
  allow read: if true;
  allow create: if isEditor(request.resource.data.projectId)
                && request.resource.data.deletedAt == null;
  allow update: if
    // new revision: editor bumps pointer + cache
    (isEditor(resource.data.projectId) && changed(['latestRevisionId','cachedMetadata'])) ||
    // metadata correction: admin only
    (isAdmin(resource.data.projectId)  && changed(['metadataOverride'])) ||
    // soft delete / restore: owner only
    (isOwner(resource.data.projectId)  && changed(['deletedAt']));
  allow delete: if false;   // soft deletes only

  match /revisions/{revisionId} {
    allow read: if true;
    allow create: if isEditor(scoreProject(scoreId));
    allow update: if isEditor(scoreProject(scoreId)) && changed(['isLatest']);
    allow delete: if false;

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
    (isEditor(resource.data.projectId) && changed(['currentRevisionId','updatedAt'])) ||
    (isAdmin(resource.data.projectId)  && changed(['title','slug','updatedAt']))     ||
    (isOwner(resource.data.projectId)  && changed(['isPublished','deletedAt','updatedAt']));
  allow delete: if false;

  match /revisions/{revisionId} {
    // non-members see only the revision the container currently points at
    allow read: if isReviewer(songbookProject(songbookId)) || (
      songbook(songbookId).isPublished == true &&
      songbook(songbookId).currentRevisionId == revisionId
    );
    // Admins may create any revision. Editors may only re-pin: `entries` and
    // `covers` must be byte-identical to the previous revision, leaving `pins`
    // as the only thing they can change. This is exactly why pins were split
    // out of `entries` in 2.6 — rules cannot diff a list element-wise.
    allow create: if isAdmin(songbookProject(songbookId)) || (
      isEditor(songbookProject(songbookId)) &&
      request.resource.data.entries == prevSbRev(songbookId).entries &&
      request.resource.data.covers  == prevSbRev(songbookId).covers
    );
    allow update, delete: if false;
  }
}

match /projects/{pid} {
  allow read: if true;
  // The creator's owner member doc is written in the same batch; see 5.0.
  allow create: if request.auth != null
                && request.resource.data.memberIds == [request.auth.uid]
                && request.resource.data.deletedAt == null
                && request.resource.data.isPublished == false;
  allow update: if
    (isEditor(pid) && changed(['title'])) ||
    // memberIds is a query index only — admins keep it in sync, it grants nothing
    (isAdmin(pid) && changed(['memberIds'])) ||
    isOwner(pid);                    // incl. isPublished, deletedAt
  allow delete: if false;

  match /members/{uid} {
    allow read: if true;
    allow create, update: if
      // Bootstrap: project creator writes their own owner doc. The project is
      // created in the same batch, so rules must read post-commit state —
      // get() would see the pre-batch world, where the project does not exist.
      (uid == request.auth.uid && request.resource.data.role == 'owner'
        && !exists(/databases/$(db)/documents/projects/$(pid)/members/$(uid))
        && getAfter(/databases/$(db)/documents/projects/$(pid)).data.memberIds == [uid]) ||
      // owner does anything
      isOwner(pid) ||
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
    allow delete: if isOwner(pid);
  }

  match /invitations/{uid} {
    allow read: if uid == request.auth.uid || isAdmin(pid);
    allow create: if isAdmin(pid)
                  && request.resource.data.role in ['editor', 'reviewer']
                  && request.resource.data.toUserId == uid
                  && request.resource.data.fromUserId == request.auth.uid
                  && request.resource.data.accepted == null;
    // invitee accepts/denies; admin cancels
    allow update: if uid == request.auth.uid || isAdmin(pid);
    allow delete: if false;
  }
}

function invitation(pid, uid) {
  return get(/databases/$(db)/documents/projects/$(pid)/invitations/$(uid)).data;
}

function prevSbRev(songbookId) {
  return get(/databases/$(db)/documents/songbooks/$(songbookId)/revisions/$(request.resource.data.prevRevisionId)).data;
}
```

> Cost note: the editor-cover-preservation check costs one extra `get()` per
> songbook revision create. Acceptable at our write volume.

### 4.3.1 Member management

The uid is in the document path, so rules read it directly — no declaration, no
`lastMemberChange`, and member changes batch freely because each document is
validated on its own.

| Actor | May write | Blocked from |
|---|---|---|
| OWNER | any member doc; delete members | — |
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

There is a second, independent flag: `projects.isPublished`. The two answer
different questions.

| Flag | Question | Effect |
|---|---|---|
| `projects.isPublished` | Are this project's scores publicly *discoverable*? | scores appear on the homepage and in public search |
| `songbooks.isPublished` | Is this songbook publicly *viewable/downloadable*? | non-members can read the current songbook revision and generate its PDFs |

Neither is an access control on score documents — `scores` and their revisions stay
world-readable so that forking an arbitrary revision works (§5.3). Project publishing
governs *listing*, not reading.

### 4.5 Storage rules (rewrite)

```js
function scoreProject(scoreId) {
  return firestore.get(/databases/(default)/documents/scores/$(scoreId)).data.projectId;
}
function role(pid) {
  return firestore.get(/databases/(default)/documents/projects/$(pid)/members/$(request.auth.uid)).data.role;
}

match /scores/{scoreId}/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null && (
    // first revision: the score doc does not exist yet, so fall back to the
    // project id embedded in the scoreId prefix is NOT safe — instead the client
    // must create the score doc first, then upload. See §5.1.
    role(scoreProject(scoreId)) in ['owner','admin','editor']
  );
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

Today's `!firestore.exists(...)` escape hatch is removed: it lets **any**
authenticated user write arbitrary bytes under a not-yet-existing score id. The
upload flow is reordered so the score doc exists before any blob is written.

---

## 5. Flows

### 5.0 Create a PROJECT

One `writeBatch`, two documents:

```ts
const batch = writeBatch(db);
batch.set(projectRef(slug), {
  title, slug, memberIds: [user.uid], isPublished: false, deletedAt: null,
  createdAt: serverTimestamp(),
});
batch.set(doc(db, "projects", slug, "members", user.uid), {
  uid: user.uid, role: "owner",
  displayName: user.displayName, email: user.email,
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
   `isLatest: true`, `origin: {type:"upload"}`) + update container
   (`latestRevisionId`, `cachedMetadata`).

### 5.2 Upload a new SCORE_REVISION (EDITOR+)

Same, but inside the transaction: read container `latestRevisionId` → that becomes
`prevRevisionId`; `revisionNumber = prev.revisionNumber + 1`; flip the previous
revision's `isLatest` to `false`. The transaction is what removes today's race in
`uploadScore.ts:50`. `cachedMetadata` is refreshed from the new upload — fixing the
current silent-discard bug where re-uploading never updates title/composer/tags.

### 5.3 Fork (any authenticated user)

1. From a score revision page, "Fork". Dialog lists projects where the user is
   EDITOR+ (from `getUserMemberProjects` filtered by role); user picks one.
2. Optional retitle. Target `scoreId = ${targetProjectId}-${slugify(title)}`.
3. Create container with `forkedFrom: {scoreId, revisionId, projectId}`.
4. Create revision 1 with `prevRevisionId: null`,
   `origin: {type:"fork", sourceScoreId, sourceRevisionId, sourceProjectId}`.

**Blobs are referenced, not copied.** The fork's revision 1 carries the *same*
`StorageFile` entries as the source revision — same `path`, same `url` — so a fork
is a pure metadata write with no byte transfer. Storage reads are public
(`allow read: if true`), so this works across projects without extra rules.

A fork therefore starts out byte-identical to its source and **diverges only when
someone uploads revision 2** into the forked score. Revision 2 onward is written
under the fork's own `scores/{forkScoreId}/{revisionId}/` prefix and is fully
self-contained.

Consequences to respect:

- A future storage-purge script (§8) **must not** delete objects still referenced by
  a forked revision. Query `scores` on `forkedFrom.scoreId` before purging anything
  under that score's prefix.
- A soft-deleted source score keeps its blobs, so existing forks keep rendering.
  Soft delete must never trigger blob removal.

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

Any REVIEWER+ comments and replies; authors edit or soft-delete their own.

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
| PROJECT | project hidden; its scores and songbooks become inaccessible (rules check `alive(pid)`); no per-doc writes; **member documents are retained** so an owner can restore with roles intact |
| SCORE | score hidden from collection/search; blobs are **never** removed (forks may reference them, §5.3); songbook entries pinning it render struck-through per §5.7 |
| SONGBOOK | songbook hidden; **scores untouched** (explicit requirement) |
| MEMBER removal | membership only; authored content untouched |

All read paths must filter `deletedAt`. Today only `getProjectScores` /
`getUserScores` do — `getAllScores` and `getLatestRevisions` do not, and
`CollectionContext` filters in application code instead.

---

## 7. Migration

Sequenced; each step is a script under `scripts/migrations/` following the existing
`Migration` interface with dry-run support.

| # | Migration | Notes |
|---|---|---|
| M0 | **Storage path audit** — `songs/**` vs `scores/**` | verify prod state first; may be a no-op or a bulk object copy |
| M1 | Backfill `deletedAt: null` and `isPublished: false` on projects, songbooks | |
| M1b | **`projects.members` map → `projects/{pid}/members/{uid}` docs** | one doc per entry; denormalize `displayName`/`email` from `users/{uid}` (readable with admin credentials); keep `memberIds`; drop the map in M9 |
| M1c | **`invitations/{autoId}` → `projects/{pid}/invitations/{uid}`** | collapse duplicates by keeping the newest pending invitation per (project, user) |
| M2 | Rename `Revision` → `ScoreRevision` in code | pure refactor, no data change |
| M3 | Add `prevRevisionId` + `slug` + `origin` to existing revisions | order by `revisionNumber`; `origin: {type:"upload"}` for all |
| M4 | Move metadata onto revisions | copy `scores.{title,composer,sub,tags}` → every revision's `metadata`; write `cachedMetadata` on the container; keep legacy top-level fields one release for rollback, drop in M9 |
| M5 | Songbook containers → container + revision 1 | existing `entries` split into `entries` + `pins`; assign `index`; resolve any `revisionId === "latest"` to the concrete current `latestRevisionId` |
| M6 | Identify the four PROJECTS — carnaval, garota, na tora, besourinhos | confirm which already exist as project docs; all owned by the CADERNIN uid; **set `isPublished: true`** (all other projects default to `false`) |
| M7 | Build SONGBOOKS per project-year | carnaval via `generateCarnivalSections`; others via `generateSectionsByStyle` (`src/utils/songBookRows.ts`); reorder manually afterwards; created with `isPublished: true` |
| M8 | Deploy rewritten `firestore.rules` + `storage.rules` | after M1–M5, since rules assume the new shape |
| M9 | Drop legacy fields: score-level metadata, `projects.members` map, top-level `invitations` | |

**Nice-to-have (not blocking):** a script that reads index pages from PDFs
previously generated by cadernin and reconstructs songbook entries + ordering,
to avoid hand-rebuilding M7.

### 7.1 The CADERNIN account

CADERNIN is an ordinary Firebase Auth user, referenced today only by
`VITE_CADERNIN_UID` in `CollectionContext.tsx:30`, where it defines "the public
collection" by filtering projects to those it owns. Three things ride on it:

1. **Credentials** — a shared password. Whoever holds it is OWNER of all four
   migrated projects. No per-person revocation; every migrated score carries
   `uploadedBy: <cadernin uid>`, so revision history cannot attribute uploads.
   With no ownership-transfer UI, losing the password loses owner access.
2. **Member lists** — it appears in `ProjectSettingsPage` as a normal member.
3. **Homepage definition** — the only signal for "is this content public".

**Decision: keep it a normal user (no org entity), and replace the uid filter with
`projects.isPublished`.** Introducing `orgs/{orgId}` with its own membership would
add a second ownership axis to every rule for no near-term gain.

`CollectionContext.tsx:30` changes from *"projects owned by `VITE_CADERNIN_UID`"* to
*"projects where `isPublished == true`"*. The four migrated projects are published by
migration (M6), so **homepage behaviour is unchanged** — every score in them keeps
appearing, whether or not it belongs to a songbook (the requirements explicitly allow
project scores outside any songbook).

Why this ordering matters: keying discovery on a *property of the project* rather than
on *who owns it* means transferring the migrated projects to real human owners later
is a pure ownership change requiring no second migration and no homepage rework. The
`VITE_CADERNIN_UID` env var disappears from application code entirely; the account
remains only as a Firebase Auth identity holding ownership until transferred.

Rejected alternative: driving the homepage off published songbooks. It would have
dropped any score not in a songbook — a behaviour regression for the migrated
collection.

---

## 8. Deferred / future improvements

- **Persisted INSTRUMENT_SONGBOOK artifacts.** Generate PDFs server-side per
  songbook revision, store at `songbooks/{id}/{revisionId}/pdfs/{instrument}.pdf`,
  serve stable links. Needed if generation time or client memory becomes a problem,
  or if we want byte-identical reproducibility.
- **Storage monitoring and per-user upload limits** (already in `TECH_DEBT.md`).
  Required before revision purging can be considered.
- **Revision purge policy.** Revisions are currently immortal. Revisit once storage
  monitoring exists. Any purge script must first check for forks referencing the
  objects (§5.3) — query `scores` on `forkedFrom.scoreId`.
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
- **cadern.in admin panel.** A cross-project operator surface, gated on a
  site-admin claim rather than a project role. Home for:
  - restoring soft-deleted projects / scores / songbooks (no restore UI ships in v1;
    until then restore is a console or script operation)
  - storage usage monitoring and per-user upload limits
  - running the revision purge once a policy exists
  - project ownership transfer
  - toggling `projects.isPublished` for projects the operator does not own

---

## 9. Task breakdown

### Phase 0 — Unblock (P0)
- [ ] 0.1 Audit deployed storage objects: `songs/**` vs `scores/**`; confirm whether uploads are currently failing
- [ ] 0.2 Fix path mismatch (align `uploadScore.ts:55` and `storage.rules`)
- [ ] 0.3 Rewrite `storage.rules` against `members` (drop dead `ownerId`/`collaboratorIds`); remove the `!exists()` write escape hatch
- [ ] 0.4 Set up Firebase Emulator + `@firebase/rules-unit-testing` (already in `TECH_DEBT.md`) — rules changes below are untestable without it

### Phase 1 — Model foundations
- [ ] 1.1 Rename `Revision` → `ScoreRevision` across `types/`, `src/lib/db.ts`, components
- [ ] 1.2 Add `deletedAt` to `zProjectData`, `zSongbookData`
- [ ] 1.3 Add `prevRevisionId`, `slug`, `metadata`, `origin` to `zRevisionData`
- [ ] 1.4 Add `cachedMetadata`, `metadataOverride`, `forkedFrom` to `zScoreData`
- [ ] 1.5 Timestamp-based revision ids + `runTransaction` in `uploadScore` (fixes the `length + 1` race and the metadata write-back bug)
- [ ] 1.6 Metadata resolution helper (`override ?? cached`) + wire `CollectionContext`, `ScorePage`, Fuse keys
- [ ] 1.7 Migrations M1, M1b, M1c, M3, M4

### Phase 2 — Permissions
- [ ] 2.0 Members + invitations subcollections: `types/docs.ts` schemas, `db.ts` CRUD, batched writes pairing member docs with `memberIds` (§2.1.1, §2.1.2)
- [ ] 2.0b Fix invitation acceptance — invitee writes their own member doc against a deterministic invitation path (currently denied by rules, §2.1.2)
- [ ] 2.0c `ProjectSettingsPage`: show `displayName`/`email` from member docs instead of raw uids (`ProjectSettingsPage.tsx:243`)
- [ ] 2.1 Extend `src/lib/roles.ts` with capability predicates (`canEditMetadata`, `canPublish`, `canRepinSongbook`, `canEditSongbookEntries`, …) — UI must not re-derive role checks inline
- [ ] 2.2 Rewrite `firestore.rules` per §4.3
- [ ] 2.3 Rules unit tests: one per row of the §4.1 matrix
- [ ] 2.4 Replace hard project/score/songbook deletes with soft deletes in `db.ts` + UI
- [ ] 2.5 Owner-only member removal / admin grants; admin restricted to editor/reviewer via the member-doc rule (§4.3.1)
- [ ] 2.6 `projects.isPublished` (owner-only) + swap `CollectionContext` off `VITE_CADERNIN_UID` (§7.1)

### Phase 3 — Songbooks
- [ ] 3.1 `SongbookRevision` schema (`entries` / `pins` / `covers` split, §2.6) + `db.ts` CRUD (copy-on-write create)
- [ ] 3.2 Persist the builder: `songbooks` collection writes (currently zero app code writes it)
- [ ] 3.3 Routes `/projects/:slug/songbooks`, `/projects/:slug/songbooks/:songbookSlug`, public `/songbooks/:projectSlug/:songbookSlug`
- [ ] 3.4 Freeze `index` at revision creation; make `createSongBook` consume it instead of computing (`createSongBook.ts:196`)
- [ ] 3.5 Stale-pin badge + "bump entry" / "bump all" actions
- [ ] 3.5b Deleted-score rendering (§5.7): `deleted` flag on `SectionScore`, struck-through index entry, omitted score pages, songbook marker
- [ ] 3.6 Per-instrument cover storage + bulk filename-matched upload (reuse `parseInstrument`) — admin-only
- [ ] 3.6b Enforce admin/editor split: editor UI exposes re-pin only; rules assert `entries`/`covers` unchanged (§4.3, §5.5)
- [ ] 3.7 Publish / unpublish (owner-only) + public songbook page
- [ ] 3.8 Songbook revision history view (member-only)
- [ ] 3.9 Migration M5

### Phase 4 — Review comments
- [ ] 4.1 `comments` subcollection schema + `db.ts` CRUD (no resolve state, §2.4)
- [ ] 4.2 Anchored pin overlay on `ScoreDisplay` SVGs (v1 includes positional pins)
- [ ] 4.3 Thread UI: create, reply, edit own, soft-delete own
- [ ] 4.4 Per-revision comment counts on the revision list and score page
- [ ] 4.5 Rules + tests

### Phase 5 — Fork
- [ ] 5.1 Target-project picker (projects where user is EDITOR+)
- [ ] 5.2 Reference-only fork: revision 1 reuses the source revision's `StorageFile` entries; no byte transfer
- [ ] 5.3 Write `origin` + `forkedFrom`
- [ ] 5.4 Lineage display: "forked from X @ revision N" with link back
- [ ] 5.5 UI copy making clear a fork diverges only once you upload a new revision

### Phase 6 — Data migration
- [ ] 6.1 M6 — reconcile the four real projects
- [ ] 6.2 M7 — build songbooks per project-year
- [ ] 6.3 M8 — deploy rules
- [ ] 6.4 M9 — drop legacy fields
- [ ] 6.5 Verify homepage parity after M6: published-project filter shows the same scores the uid filter did
- [ ] 6.6 (nice-to-have) PDF index-page → songbook reconstruction script

---

## 10. Open questions

None blocking. Phase 0 (§9) can start.

Things to watch rather than decide now:

- **Editor re-pin scope.** Editors can change `pins` but not `entries`, so an editor
  who wants a *new* score in a songbook must ask an admin. If that turns out to be a
  daily friction, the fix is a narrower admin capability, not loosening the rule.
- **No way to close a comment thread without a new revision.** Accepted consequence
  of dropping resolve (§2.4). If reviewers start asking for it, revisit.
- **`memberIds` can drift from the member documents** (§2.1.1). Harmless by
  construction — it is a query index and grants nothing — but a periodic
  reconciliation check in the admin panel (§8) would be cheap insurance.
- **Denormalized `displayName`/`email` on member docs go stale** if a user renames
  themselves. Acceptable for now; a Cloud Function fan-out would fix it, and the
  displayName-uniqueness item in `TECH_DEBT.md` already points at a function.

---

## 11. Decision log

| Decision | Where |
|---|---|
| Members move to `projects/{pid}/members/{uid}`; `memberIds` kept as a query index only | §2.1.1 |
| Invitations move to `projects/{pid}/invitations/{uid}`, fixing acceptance being rules-denied | §2.1.2 |
| Member docs denormalize `displayName`/`email` — the only way to show names, given `users/{uid}` read rules | §2.1.1 |
| `metadataOverride` kept as an admin layer over revision metadata | §2.2 |
| Publishing is orthogonal to revisions; two independent flags (project, songbook) | §4.4 |
| Songbook entries pin exact score revisions; stale badge + editor bump | §2.6.1 |
| INSTRUMENT_SONGBOOKs generated client-side, not persisted | §5.6, §8 |
| Deleted score in a songbook: keep index, strike title, omit pages, add marker | §5.7 |
| Forks reference source blobs; divergence happens on the next uploaded revision | §5.3 |
| Comment positional pins ship in v1 | §5.4 |
| Reviewers get full read on unpublished songbooks incl. revision history | §4.1 |
| Project soft delete retains the `members` map, so restore keeps roles | §2.1, §6 |
| `scoreId` frozen at revision 1; mutable `displaySlug` deferred | §8 |
| CADERNIN stays a normal user; discovery keyed on `projects.isPublished` | §7.1 |
| Migrated projects and their songbooks are published by default | §7 (M6, M7) |
| Comments never carry over between revisions | §5.4 |
| No resolve/solved state — supersedes `REQUIREMENTS.md` | §2.4 |
| Only ADMIN creates songbooks and edits `entries`/`covers`; EDITOR re-pins only | §4.1, §5.5 |
| `pins` split out of `entries` so the admin/editor split is rules-enforceable | §2.6 |
| Restore UI deferred to a cadern.in admin panel | §8 |
| Revision purging deferred behind storage monitoring; must respect fork refs | §8 |
