import { slugify } from "./slugify";

/** `YYYYMMDDTHHmmss`, in UTC. */
export function revisionTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

/** Human-readable revision slug: `${slugify(title)}-${timestamp}`. */
export function revisionSlug(title: string, date: Date): string {
  return `${slugify(title)}-${revisionTimestamp(date)}`;
}

/**
 * Revision document id: the slug plus 4 random characters, so concurrent
 * uploads can't collide (collab-flow §2.3). Revisions created before this
 * format keep their numeric ids.
 */
export function newRevisionId(
  slug: string,
  random: () => number = Math.random,
): string {
  const suffix = Array.from({ length: 4 }, () =>
    Math.floor(random() * 36).toString(36),
  ).join("");
  return `${slug}-${suffix}`;
}
