import type { ReviewCommentDoc } from "../../types/docs";
import type { WithId } from "./db";

type Comment = WithId<ReviewCommentDoc>;

export interface CommentThread {
  root: Comment;
  replies: Comment[];
  // Pinned roots are numbered in creation order, matching their pins.
  pinNumber: number | null;
}

/**
 * Groups comments into one-level threads, oldest first. A deleted root stays
 * when it has live replies (shown as removed) and loses its pin number.
 */
export function commentThreads(comments: Comment[]): CommentThread[] {
  const replies = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parentId) {
      replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
    }
  }
  let pin = 0;
  return comments
    .filter((c) => !c.parentId)
    .map((root) => ({
      root,
      replies: (replies.get(root.id) ?? []).filter((r) => !r.deletedAt),
      pinNumber: root.anchor && !root.deletedAt ? ++pin : null,
    }))
    .filter((t) => !t.root.deletedAt || t.replies.length > 0);
}
