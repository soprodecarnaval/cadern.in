import z from "zod";
import { zInstrument, zPart } from "./types.js";

// Firestore Timestamps (serverTimestamp() on write, Timestamp on read)
const zTimestamp = z.any();

export const zUserData = z.object({
  displayName: z.string(),
  email: z.string().email(),
});
export const zUserDoc = zUserData.extend({ createdAt: zTimestamp });
export type UserData = z.infer<typeof zUserData>;
export type UserDoc = z.infer<typeof zUserDoc>;

export const zProjectData = z.object({
  title: z.string(),
  ownerId: z.string(),
  collaboratorIds: z.array(z.string()),
});
export const zProjectDoc = zProjectData.extend({ createdAt: zTimestamp });
export type ProjectData = z.infer<typeof zProjectData>;
export type ProjectDoc = z.infer<typeof zProjectDoc>;

export const zScoreData = z.object({
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
  projectId: z.string(),
  uploadedBy: z.string(),
  latestRevisionId: z.string(),
});
export const zScoreDoc = zScoreData.extend({
  createdAt: zTimestamp,
  deletedAt: zTimestamp.nullable().optional(),
});
export type ScoreData = z.infer<typeof zScoreData>;
export type ScoreDoc = z.infer<typeof zScoreDoc>;

export const zRevisionData = z.object({
  revisionNumber: z.number().int().positive(),
  uploadedBy: z.string(),
  mscz: z.string(),
  metajson: z.string(),
  midi: z.string(),
  parts: z.array(zPart),
  notes: z.string(),
  isLatest: z.boolean(),
});
export const zRevisionDoc = zRevisionData.extend({ uploadedAt: zTimestamp });
export type RevisionData = z.infer<typeof zRevisionData>;
export type RevisionDoc = z.infer<typeof zRevisionDoc>;

export const zSongbookEntry = z.object({
  scoreId: z.string(),
  revisionId: z.string(),
  order: z.number().int(),
  instruments: z.array(zInstrument),
});
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
