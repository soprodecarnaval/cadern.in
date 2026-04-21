import z from "zod";
import { zInstrument } from "./instrument";

const zTimestamp = z.any();

export const zPartData = z.object({
  name: z.string(),
  instrument: zInstrument,
  svg: z.array(z.string()),
  midi: z.string(),
});
export type PartData = z.infer<typeof zPartData>;

export const zUserData = z.object({
  displayName: z.string(),
  email: z.string().email(),
});
export const zUserDoc = zUserData.extend({ createdAt: zTimestamp });
export type UserDoc = z.infer<typeof zUserDoc>;

export const zUserProjectRole = z.enum(["owner", "admin", "editor", "reviewer"]);
export type UserProjectRole = z.infer<typeof zUserProjectRole>;

export const zProjectCreateData = z.object({
  title: z.string(),
  members: z.record(zUserProjectRole),
});
export type ProjectCreateData = z.infer<typeof zProjectCreateData>;

export const zProjectData = z.object({
  title: z.string(),
  slug: z.string(),
  members: z.record(zUserProjectRole),
  memberIds: z.array(z.string()),
});
export const zProjectDoc = zProjectData.extend({ createdAt: zTimestamp });
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
export type ScoreDoc = z.infer<typeof zScoreDoc>;

export const zRevisionData = z.object({
  revisionNumber: z.number().int().positive(),
  uploadedBy: z.string(),
  mscz: z.string(),
  metajson: z.string(),
  midi: z.string(),
  parts: z.array(zPartData),
  notes: z.string(),
  isLatest: z.boolean(),
});
export const zRevisionDoc = zRevisionData.extend({ uploadedAt: zTimestamp });
export type RevisionDoc = z.infer<typeof zRevisionDoc>;

export const zSongbookScoreRef = z.object({
  type: z.literal("score"),
  scoreId: z.string(),
  revisionId: z.string(), // "latest" is a valid special value
  order: z.number().int(),
});
export type SongbookScoreRef = z.infer<typeof zSongbookScoreRef>;

export const zSongbookSectionEntry = z.object({
  type: z.literal("section"),
  title: z.string(),
  order: z.number().int(),
});
export type SongbookSectionEntry = z.infer<typeof zSongbookSectionEntry>;

export const zSongbookEntry = z.discriminatedUnion("type", [
  zSongbookScoreRef,
  zSongbookSectionEntry,
]);
export type SongbookEntry = z.infer<typeof zSongbookEntry>;

export const zSongbookData = z.object({
  title: z.string(),
  projectId: z.string(),
  slug: z.string(),
  isPublished: z.boolean(),
  entries: z.array(zSongbookEntry),
});
export const zSongbookDoc = zSongbookData.extend({
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type SongbookDoc = z.infer<typeof zSongbookDoc>;

export const zUserProjectInvitationData = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  projectId: z.string(),
  role: zUserProjectRole,
  accepted: z.boolean().nullable(),
});
export const zUserProjectInvitationDoc = zUserProjectInvitationData.extend({
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  deletedAt: zTimestamp.nullable(),
});
export type UserProjectInvitationDoc = z.infer<typeof zUserProjectInvitationDoc>;
