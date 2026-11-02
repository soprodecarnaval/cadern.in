# 005 — Review comments

**Goal:** Project members review a score version with comments, pinned to a
spot on a part's page or about the version as a whole.

**Depends on:** 001, 002.

Spec: PLAN §2.4, §4.3 (`comments`), §5.4.

## Decisions

- **No resolve state**; comments never carry over between versions (PLAN §2.4) —
  a new version starts empty, the old one keeps its comments.
- **Members only.** The panel, pins and counts render only for members of the
  score's project; non-members see the plain score page. Rules enforce reads too.
- **`authorName` is stored with the comment** (denormalized from Auth), like
  invitations; it may go stale on rename.
- **Threads are one level deep.** Roots carry an optional anchor; replies never do.
- **One way to start a comment:** a textbox pinned to the top of the
  "Comentários" panel, with "📍 Marcar ponto" left of "Enviar". Marking a point
  means clicking the score; without one, the comment is about the whole version.
  The panel always lists every thread; clicking a pin scrolls to and highlights
  its thread.

## Steps

1. ✅ Schema `zReviewCommentData` / `zCommentAnchor`; `db.ts` `getComments`,
   `addComment` (roots and replies), `editComment`, `softDeleteComment`,
   `countComments` (`getCountFromServer`).
2. ✅ `ScoreDisplay`: numbered pins on each part page, and point picking.
3. ✅ `ReviewCommentsPanel`: composer, threads (`commentThreads`, + tests), replies,
   edit / delete own, "comentário removido" for deleted roots with replies.
4. ✅ Score page: panel beside the score (sticky) for members; "N comentários" per
   version in the version list, and the panel's "Comentários (N)".
5. ✅ Rules + tests: read/create for members; author = caller; valid body; roots
   with a null or valid anchor; replies to an existing root, without anchor; author
   edits body / soft-deletes only; no hard delete; deleted project freezes them.
6. ✅ Seed: a pinned thread with a reply and a general comment on "Olha pro Céu"
   version 1.

## Files

- `types/docs.ts`, `src/lib/db.ts`, `src/lib/comments.ts` (+ test)
- `src/tsx/ScoreDisplay.tsx`, `src/tsx/ReviewCommentsPanel.tsx`,
  `src/tsx/ScorePage.tsx`, `src/tsx/ScoreRevisionList.tsx`
- `firestore.rules`, `tests/rules/firestore.test.ts`, `scripts/dev/seedEmulators.ts`

## Acceptance

- A reviewer pins a comment on page 2 of a part; another member sees it at the
  same spot and replies.
- Uploading a new version shows an empty thread; the old version's comments stay
  on its page.
- Non-members and non-authors cannot read / edit (rules tests).
