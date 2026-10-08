import type { User } from "firebase/auth";
import type { SongbookItemViewModel } from "../../types/viewModels";
import {
  createSongbook,
  getProjectScoreLinks,
  getSongbook,
} from "./db";
import { slugify } from "./slugify";
import { isSongbookSection, toSongbookRevisionContent } from "./songbook";

/**
 * Saves a builder list as a new songbook of `projectId`. Scores from other
 * projects are linked into it in the same batch, since a songbook may only use
 * its project's own and linked scores (collab-flow §2.1.3).
 */
export async function saveAsNewSongbook(input: {
  projectId: string;
  title: string;
  items: SongbookItemViewModel[];
  user: User;
}): Promise<{ slug: string }> {
  const slug = slugify(input.title);
  if (!slug) {
    throw new Error("Dê um título ao caderninho.");
  }
  if (await getSongbook(input.projectId, slug)) {
    throw new Error("Já existe um caderninho com esse título neste projeto.");
  }

  const linked = new Set(
    (await getProjectScoreLinks(input.projectId)).map((l) => l.scoreId),
  );
  const links = input.items
    .flatMap((item) => (isSongbookSection(item) ? [] : [item.score]))
    .filter((s) => s.projectId !== input.projectId && !linked.has(s.id))
    .map((s) => ({ scoreId: s.id, sourceProjectId: s.projectId }));

  await createSongbook({
    projectId: input.projectId,
    slug,
    title: input.title.trim(),
    content: toSongbookRevisionContent(input.items),
    createdBy: input.user.uid,
    links,
  });
  return { slug };
}
