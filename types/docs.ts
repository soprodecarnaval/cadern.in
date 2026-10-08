import z from "zod";
import { Timestamp } from "firebase/firestore";
import { zInstrument } from "./instrument";

const zTimestamp = z.custom<Timestamp>();

export const zStorageFile = z.object({
  path: z.string(),
  url: z.string(),
});
export type StorageFile = z.infer<typeof zStorageFile>;

export const zPartData = z.object({
  name: z.string(),
  instrument: zInstrument,
  svg: z.array(zStorageFile),
  midi: zStorageFile,
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

export const zInvitableRole = z.enum(["editor", "reviewer"]);
export type InvitableRole = z.infer<typeof zInvitableRole>;

export const zProjectCreateData = z.object({
  title: z.string(),
});
export type ProjectCreateData = z.infer<typeof zProjectCreateData>;

export const zProjectData = z.object({
  title: z.string(),
  slug: z.string(),
  // Query index for "my projects" only — never consulted for permissions.
  memberIds: z.array(z.string()),
  // Legacy role map, superseded by `projects/{id}/members`. Read only by
  // flag-off code; dropped in collab-flow M9.
  members: z.record(zUserProjectRole).optional(),
});
export const zProjectDoc = zProjectData.extend({
  createdAt: zTimestamp,
  // Optional until collab-flow M1 backfills it.
  deletedAt: zTimestamp.nullable().optional(),
});
export type ProjectDoc = z.infer<typeof zProjectDoc>;

export const zProjectMemberData = z.object({
  uid: z.string(),
  role: zUserProjectRole,
  displayName: z.string(),
  addedBy: z.string(),
});
export const zProjectMemberDoc = zProjectMemberData.extend({
  addedAt: zTimestamp,
});
export type ProjectMemberDoc = z.infer<typeof zProjectMemberDoc>;

export const zScoreMetadata = z.object({
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
});
export type ScoreMetadata = z.infer<typeof zScoreMetadata>;

export const zScoreData = z.object({
  projectId: z.string(),
  uploadedBy: z.string(),
  latestRevisionId: z.string(),
  // Legacy display fields, read by flag-off code. Dual-written with
  // `cachedMetadata` until collab-flow M9; read through resolveScoreMetadata.
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
  // Latest revision's metadata. Optional until collab-flow M4 backfills it.
  cachedMetadata: zScoreMetadata.optional(),
  // Admin corrections; win over `cachedMetadata` field by field.
  metadataOverride: zScoreMetadata.partial().optional(),
  forkedFrom: z
    .object({ scoreId: z.string(), revisionId: z.string(), projectId: z.string() })
    .optional(),
  // Maintained server-side (collab-flow §2.2.1); clients never write it.
  published: z
    .object({ revisionId: z.string(), songbookIds: z.array(z.string()) })
    .nullable()
    .optional(),
});
export type ScoreData = z.infer<typeof zScoreData>;
export const zScoreDoc = zScoreData.extend({
  createdAt: zTimestamp,
  deletedAt: zTimestamp.nullable().optional(),
});
export type ScoreDoc = z.infer<typeof zScoreDoc>;

export const zScoreRevisionOrigin = z.discriminatedUnion("type", [
  z.object({ type: z.literal("upload") }),
  z.object({
    type: z.literal("fork"),
    sourceScoreId: z.string(),
    sourceRevisionId: z.string(),
    sourceProjectId: z.string(),
  }),
]);

export const zScoreRevisionData = z.object({
  revisionNumber: z.number().int().positive(),
  uploadedBy: z.string(),
  mscz: zStorageFile,
  metajson: zStorageFile,
  midi: zStorageFile,
  parts: z.array(zPartData),
  notes: z.string(),
  // Optional until collab-flow M3/M4 backfill them; every new revision has
  // them (zNewScoreRevisionData).
  prevRevisionId: z.string().nullable().optional(),
  slug: z.string().optional(),
  metadata: zScoreMetadata.optional(),
  origin: zScoreRevisionOrigin.optional(),
});
export const zScoreRevisionDoc = zScoreRevisionData.extend({
  uploadedAt: zTimestamp,
});
export type ScoreRevisionDoc = z.infer<typeof zScoreRevisionDoc>;

export const zNewScoreRevisionData = zScoreRevisionData.required({
  prevRevisionId: true,
  slug: true,
  metadata: true,
  origin: true,
});
export type NewScoreRevisionData = z.infer<typeof zNewScoreRevisionData>;

// Shape of `scores/{id}/revisions/{id}`, which flag-off code still reads. Kept
// in sync by dual-writes until the legacy subcollection is dropped (M9).
export const zLegacyRevisionData = zScoreRevisionData.extend({
  isLatest: z.boolean(),
});

export const zSongbookScoreEntry = z.object({
  type: z.literal("score"),
  scoreId: z.string(),
  order: z.number().int(),
  // Frozen when the revision is created, so every instrument's PDF shares the
  // numbering (collab-flow §2.6). Sections don't take a number.
  index: z.number().int().positive(),
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
  projectId: z.string(),
  // Unique within the project and fixed at creation: the id is
  // `${projectId}~${slug}` and public URLs use it.
  slug: z.string(),
  currentRevisionId: z.string(),
  isPublished: z.boolean(),
});
export const zSongbookDoc = zSongbookData.extend({
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  deletedAt: zTimestamp.nullable(),
});
export type SongbookDoc = z.infer<typeof zSongbookDoc>;

export const zSongbookRevisionContent = z.object({
  // Structure: which scores, in what order, under which sections. Admin-only.
  entries: z.array(zSongbookEntry),
  // Which revision of each score is used, keyed by score id. Editors may
  // change only this (collab-flow §5.5), which is why it isn't in `entries`.
  pins: z.record(z.string()),
  // Per-instrument cover image. Admin-only.
  covers: z.record(zInstrument, zStorageFile),
});
export type SongbookRevisionContent = z.infer<typeof zSongbookRevisionContent>;

export const zSongbookRevisionData = zSongbookRevisionContent.extend({
  revisionNumber: z.number().int().positive(),
  prevRevisionId: z.string().nullable(),
  createdBy: z.string(),
  note: z.string(),
});
export const zSongbookRevisionDoc = zSongbookRevisionData.extend({
  createdAt: zTimestamp,
});
export type SongbookRevisionDoc = z.infer<typeof zSongbookRevisionDoc>;

export const zScoreLinkData = z.object({
  scoreId: z.string(),
  sourceProjectId: z.string(),
  addedBy: z.string(),
});
export const zScoreLinkDoc = zScoreLinkData.extend({
  addedAt: zTimestamp,
  deletedAt: zTimestamp.nullable(),
});
export type ScoreLinkDoc = z.infer<typeof zScoreLinkDoc>;

export const zUserProjectInvitationData = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  projectId: z.string(),
  role: zInvitableRole,
  accepted: z.boolean().nullable(),
  // Denormalized: neither side can read the other's user record.
  projectTitle: z.string(),
  fromDisplayName: z.string(),
  toDisplayName: z.string(),
});
export const zUserProjectInvitationDoc = zUserProjectInvitationData.extend({
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  deletedAt: zTimestamp.nullable(),
});
export type UserProjectInvitationDoc = z.infer<typeof zUserProjectInvitationDoc>;
