# 005 — Review comments

**Goal:** Project members review a score revision with comments pinned to a
position on a part page.

**Depends on:** 001, 002.

Spec: PLAN §2.4, §4.3 (`comments`), §5.4.

## Decisions

- **No resolve state**; comments never carry over between revisions (PLAN §2.4).
- **Positional pins ship in v1**: anchor `(partName, page, x?, y?)` with normalized
  coordinates.
- **Members only.** Pins, threads and counts render only for members of the
  score's project; non-members see the plain score page. Rules enforce the read
  side as well.

## Steps

1. Schema `zReviewComment`; `db.ts` create / reply / edit own / soft-delete own /
   list by revision / count by revision (`getCountFromServer`).
2. `ScoreDisplay` overlay: render pins for the current part+page; click empty spot
   to start a thread at normalized `(x, y)`.
3. Thread panel: root + replies, edit/delete own, author `displayName` from member
   docs.
4. Comment count per revision on the revision list and for the latest revision on
   the score page.
5. Rules: read/create REVIEWER+, `authorId == auth.uid`; update author-only on
   `body`/`updatedAt`/`deletedAt`; no delete. Tests.

## Files

- `types/docs.ts`, `src/lib/db.ts`, `src/lib/roles.ts`
- `src/tsx/ScoreDisplay.tsx`, `src/tsx/ScorePage.tsx`, new comment components
- `firestore.rules`, `tests/rules/`

## Acceptance

- A reviewer pins a comment on page 2 of a part; another reviewer sees it at the
  same spot and replies.
- Uploading a new revision shows an empty thread; the old revision's comments stay
  on its page.
- Non-members and non-authors cannot read / edit (rules tests).
