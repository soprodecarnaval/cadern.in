// Copy a songbook into another project (ticket 029). The copy pins the same
// score revisions, keeps the sections and covers, and starts unpublished;
// scores stay in their projects.
import { isReservedSongbookSlug } from "./routes";
import { slugify } from "./slugify";

export type DuplicateSongbookServices = Pick<
  typeof import("./db"),
  "getSongbookById" | "getSongbookRevision" | "getSongbook" | "createSongbook"
>;

/** "Cópia de <título>", the copy's default title. */
export const copyTitle = (title: string) => `Cópia de ${title}`;

/** A slug for `title` not yet used in `projectId`: `-2`, `-3`… on collision. */
export async function freeSongbookSlug(
  projectId: string,
  title: string,
  getSongbook: DuplicateSongbookServices["getSongbook"],
): Promise<string> {
  let base = slugify(title.trim()).replace(/^-+|-+$/g, "");
  if (!/[a-z0-9]/.test(base) || isReservedSongbookSlug(base)) {
    base = base && /[a-z0-9]/.test(base) ? `${base}-caderninho` : "caderninho";
  }
  let slug = base;
  for (let n = 2; await getSongbook(projectId, slug); n++) {
    if (n > 100) {
      throw new Error("Já existem muitos caderninhos com esse título. Escolha outro.");
    }
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function duplicateSongbook(
  input: {
    sourceId: string;
    targetProjectId: string;
    title: string;
    createdBy: string;
  },
  services: DuplicateSongbookServices,
): Promise<{ projectId: string; slug: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Dê um título ao caderninho.");
  }
  const source = await services.getSongbookById(input.sourceId);
  if (!source || source.deletedAt) {
    throw new Error("Caderninho não encontrado.");
  }
  const revision = await services.getSongbookRevision(source.id, source.currentRevisionId);
  if (!revision) {
    throw new Error("Não foi possível ler este caderninho.");
  }
  const slug = await freeSongbookSlug(input.targetProjectId, title, services.getSongbook);
  await services.createSongbook({
    projectId: input.targetProjectId,
    slug,
    title,
    content: {
      entries: revision.entries, pins: revision.pins, covers: revision.covers,
      // The copy prints like the original (037).
      ...(revision.print ? { print: revision.print } : {}),
    },
    createdBy: input.createdBy,
    note: `Cópia de ${source.projectId}/${source.slug} v${revision.revisionNumber}`,
  });
  return { projectId: input.targetProjectId, slug };
}
