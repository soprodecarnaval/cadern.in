import z from "zod";
import { zInstrument, zPart } from "./types.js";

// Firestore Timestamps (serverTimestamp() on write, Timestamp on read)
const zTimestamp = z.any();

export const zUserDoc = z.object({
  displayName: z.string(),
  email: z.string().email(),
  createdAt: zTimestamp,
});
export type UserDoc = z.infer<typeof zUserDoc>;

export const zProjectDoc = z.object({
  title: z.string(),
  ownerId: z.string(),
  collaboratorIds: z.array(z.string()),
  createdAt: zTimestamp,
});
export type ProjectDoc = z.infer<typeof zProjectDoc>;

export const zSongDoc = z.object({
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
  projectId: z.string(),
  uploadedBy: z.string(),
  latestRevisionId: z.string(),
  createdAt: zTimestamp,
  deletedAt: zTimestamp.nullable().optional(),
});
export type SongDoc = z.infer<typeof zSongDoc>;

export const zRevisionDoc = z.object({
  revisionNumber: z.number().int().positive(),
  uploadedBy: z.string(),
  uploadedAt: zTimestamp,
  mscz: z.string(),
  metajson: z.string(),
  midi: z.string(),
  parts: z.array(zPart),
  notes: z.string(),
  isLatest: z.boolean(),
});
export type RevisionDoc = z.infer<typeof zRevisionDoc>;

export const zSongbookEntry = z.object({
  songId: z.string(),
  revisionId: z.string(),
  order: z.number().int(),
  instrument: zInstrument.optional(),
});
export type SongbookEntry = z.infer<typeof zSongbookEntry>;

export const zSongbookDoc = z.object({
  title: z.string(),
  ownerId: z.string(),
  slug: z.string(),
  isPublished: z.boolean(),
  entries: z.array(zSongbookEntry),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type SongbookDoc = z.infer<typeof zSongbookDoc>;
