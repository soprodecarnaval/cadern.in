import z from "zod";

const zTimestamp = z.any();

export const zSongbookScoreEntry = z.object({
  type: z.literal("score"),
  scoreId: z.string(),
  revisionId: z.string(),
  order: z.number().int(),
});
export type SongbookScoreEntry = z.infer<typeof zSongbookScoreEntry>;

export const zSongbookSectionEntry = z.object({
  type: z.literal("section"),
  title: z.string(),
  order: z.number().int(),
});
export type SongbookSectionEntry = z.infer<typeof zSongbookSectionEntry>;

export const zSongbookEntry = z.discriminatedUnion("type", [
  zSongbookScoreEntry,
  zSongbookSectionEntry,
]);
export type SongbookEntry = z.infer<typeof zSongbookEntry>;

export const zSongbookData = z.object({
  title: z.string(),
  ownerId: z.string(),
  slug: z.string(),
  isPublished: z.boolean(),
  entries: z.array(zSongbookEntry),
});
export const zSongbookDoc = zSongbookData.extend({
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type SongbookData = z.infer<typeof zSongbookData>;
export type SongbookDoc = z.infer<typeof zSongbookDoc>;
