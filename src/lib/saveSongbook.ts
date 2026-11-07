import type { User } from "firebase/auth";
import type { SongbookItemViewModel } from "../../types/viewModels";
import { createSongbook, getSongbook } from "./db";
import { slugify } from "./slugify";
import { toSongbookRevisionContent } from "./songbook";

/** Saves a builder list as a new songbook of `projectId`. */
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

  await createSongbook({
    projectId: input.projectId,
    slug,
    title: input.title.trim(),
    content: toSongbookRevisionContent(input.items),
    createdBy: input.user.uid,
  });
  return { slug };
}
