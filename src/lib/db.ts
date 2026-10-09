import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDocs,
  getDoc,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { newRevisionId, revisionSlug } from "./revisionId";
import {
  zScoreDoc,
  zScoreData,
  zScoreMetadata,
  zScoreLinkData,
  zScoreLinkDoc,
  zSongbookData,
  zSongbookDoc,
  zSongbookRevisionData,
  zSongbookRevisionDoc,
  zScoreRevisionDoc,
  zNewScoreRevisionData,
  zLegacyRevisionData,
  zProjectDoc,
  zProjectData,
  zProjectCreateData,
  zProjectMemberData,
  zProjectMemberDoc,
  zUserProjectInvitationDoc,
  zUserProjectInvitationData,
  type ScoreDoc,
  type ScoreLinkDoc,
  type SongbookDoc,
  type SongbookRevisionContent,
  type SongbookRevisionDoc,
  type ScoreMetadata,
  type NewScoreRevisionData,
  type ScoreRevisionDoc,
  type ProjectDoc,
  type ProjectCreateData,
  type ProjectMemberDoc,
  type UserProjectRole,
  type UserProjectInvitationDoc,
} from "../../types/docs";
import type z from "zod";

type UserProjectInvitationData = z.infer<typeof zUserProjectInvitationData>;

export type WithId<T> = T & { id: string };

// -- Scores --

export async function getScore(id: string): Promise<WithId<ScoreDoc> | null> {
  const snap = await getDoc(doc(db, "scores", id));
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...zScoreDoc.parse(snap.data()) };
}

// Score revisions live in two subcollections until the legacy one is dropped
// (collab-flow M9). Every write goes to both, with the same data; reads stay on
// the legacy one — the only one flag-off code and older export-app builds know —
// until the launch (collab-flow 007).
const SCORE_REVISIONS = "scoreRevisions";
const LEGACY_REVISIONS = "revisions";

export async function getScoreRevision(
  scoreId: string,
  revisionId: string,
): Promise<WithId<ScoreRevisionDoc> | null> {
  const snap = await getDoc(
    doc(db, "scores", scoreId, LEGACY_REVISIONS, revisionId),
  );
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...zScoreRevisionDoc.parse(snap.data()) };
}

export async function getScoreRevisions(
  scoreId: string,
): Promise<WithId<ScoreRevisionDoc>[]> {
  const snap = await getDocs(
    collection(db, "scores", scoreId, LEGACY_REVISIONS),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...zScoreRevisionDoc.parse(d.data()) }))
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

export async function getProjectScores(
  projectId: string,
): Promise<WithId<ScoreDoc>[]> {
  const snap = await getDocs(
    query(collection(db, "scores"), where("projectId", "==", projectId)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...zScoreDoc.parse(d.data()) }))
    .filter((s) => !s.deletedAt);
}

export async function getUserScores(uid: string): Promise<WithId<ScoreDoc>[]> {
  const snap = await getDocs(
    query(collection(db, "scores"), where("uploadedBy", "==", uid)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...zScoreDoc.parse(d.data()) }))
    .filter((s) => !s.deletedAt);
}

export async function getAllScores(): Promise<WithId<ScoreDoc>[]> {
  const snap = await getDocs(collection(db, "scores"));
  return snap.docs.map((d) => ({ id: d.id, ...zScoreDoc.parse(d.data()) }));
}

export async function getLatestScoreRevisions(): Promise<
  (WithId<ScoreRevisionDoc> & { scoreId: string })[]
> {
  const snap = await getDocs(
    query(
      collectionGroup(db, LEGACY_REVISIONS),
      where("isLatest", "==", true),
    ),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    scoreId: d.ref.parent.parent!.id,
    ...zScoreRevisionDoc.parse(d.data()),
  }));
}

function scoreRef(id: string) {
  return doc(db, "scores", id);
}

/**
 * Creates the container before any revision exists (`latestRevisionId: ""`),
 * so storage rules can resolve the project while its files upload.
 */
export async function createScore(
  id: string,
  data: { projectId: string; uploadedBy: string; metadata: ScoreMetadata },
): Promise<void> {
  const metadata = zScoreMetadata.parse(data.metadata);
  await setDoc(scoreRef(id), {
    ...zScoreData.parse({
      projectId: data.projectId,
      uploadedBy: data.uploadedBy,
      latestRevisionId: "",
      ...metadata,
      cachedMetadata: metadata,
    }),
    published: null,
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
}

/**
 * Sets the admin corrections over the score's revision metadata. Fields left
 * out fall back to the latest revision's; an empty override is removed.
 */
export async function updateScoreMetadataOverride(
  id: string,
  override: Partial<ScoreMetadata>,
): Promise<void> {
  const parsed = zScoreMetadata.partial().parse(override);
  await updateDoc(scoreRef(id), {
    metadataOverride: Object.keys(parsed).length > 0 ? parsed : deleteField(),
  });
}

export async function softDeleteScore(id: string): Promise<void> {
  await updateDoc(doc(db, "scores", id), {
    deletedAt: serverTimestamp(),
  });
}

/**
 * Appends a revision to the score's chain, in one transaction: the new
 * revision links to the current latest (`prevRevisionId`), takes the next
 * `revisionNumber`, and becomes `latestRevisionId`, with its metadata cached on
 * the container. Concurrent uploads retry rather than overwrite each other.
 *
 * Writes both revision subcollections; the legacy copy also carries `isLatest`
 * and the container its legacy metadata fields (collab-flow §0).
 */
export async function commitScoreRevision(
  scoreId: string,
  revisionId: string,
  data: Omit<NewScoreRevisionData, "revisionNumber" | "prevRevisionId">,
): Promise<{ revisionNumber: number }> {
  return runTransaction(db, async (tx) => {
    const scoreSnap = await tx.get(scoreRef(scoreId));
    if (!scoreSnap.exists()) {
      throw new Error(`Score ${scoreId} not found`);
    }
    const prevRevisionId = zScoreDoc.parse(scoreSnap.data()).latestRevisionId || null;

    let revisionNumber = 1;
    if (prevRevisionId) {
      const prevSnap = await tx.get(
        doc(db, "scores", scoreId, LEGACY_REVISIONS, prevRevisionId),
      );
      revisionNumber =
        zScoreRevisionDoc.parse(prevSnap.data()).revisionNumber + 1;
    }

    const revision = zNewScoreRevisionData.parse({
      ...data,
      revisionNumber,
      prevRevisionId,
    });
    tx.set(doc(db, "scores", scoreId, SCORE_REVISIONS, revisionId), {
      ...revision,
      uploadedAt: serverTimestamp(),
    });
    tx.set(doc(db, "scores", scoreId, LEGACY_REVISIONS, revisionId), {
      ...zLegacyRevisionData.parse({ ...revision, isLatest: true }),
      uploadedAt: serverTimestamp(),
    });
    if (prevRevisionId) {
      tx.update(doc(db, "scores", scoreId, LEGACY_REVISIONS, prevRevisionId), {
        isLatest: false,
      });
    }
    tx.update(scoreRef(scoreId), {
      latestRevisionId: revisionId,
      cachedMetadata: revision.metadata,
      ...revision.metadata,
    });
    return { revisionNumber };
  });
}

// -- Projects --

function projectRef(slug: string) {
  return doc(db, "projects", slug);
}

function parseProject(snap: {
  id: string;
  data(): Record<string, unknown>;
}): WithId<ProjectDoc> {
  return { id: snap.id, ...zProjectDoc.parse(snap.data()) };
}

export async function getProjectBySlug(
  slug: string,
): Promise<WithId<ProjectDoc> | null> {
  const snap = await getDoc(projectRef(slug));
  if (!snap.exists()) {
    return null;
  }
  return parseProject(snap);
}

/** @deprecated use getProjectBySlug */
export const getProject = getProjectBySlug;

// Filtered in code, not with `where("deletedAt", "==", null)`: that would also
// drop projects created before the field existed.
const isLive = (project: ProjectDoc) => !project.deletedAt;

export async function getUserMemberProjects(
  uid: string,
): Promise<WithId<ProjectDoc>[]> {
  const snap = await getDocs(
    query(
      collection(db, "projects"),
      where("memberIds", "array-contains", uid),
    ),
  );
  return snap.docs.map(parseProject).filter(isLive);
}

export async function getAllProjects(): Promise<WithId<ProjectDoc>[]> {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map(parseProject).filter(isLive);
}

function memberRef(slug: string, uid: string) {
  return doc(db, "projects", slug, "members", uid);
}

/** Writes the project and its creator's owner member document together. */
export async function createProject(
  slug: string,
  data: ProjectCreateData,
  owner: { uid: string; displayName: string },
): Promise<void> {
  const { title } = zProjectCreateData.parse(data);
  const batch = writeBatch(db);
  batch.set(projectRef(slug), {
    ...zProjectData.parse({ title, slug, memberIds: [owner.uid] }),
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
  batch.set(memberRef(slug, owner.uid), {
    ...zProjectMemberData.parse({
      uid: owner.uid,
      role: "owner",
      displayName: owner.displayName,
      addedBy: owner.uid,
    }),
    addedAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Soft-deletes the project, cancelling its pending invitations in the same
 * batch so they leave invitees' inboxes. Its scores and members stay; nothing
 * under a deleted project can be written any more (firestore.rules `alive`).
 */
export async function softDeleteProject(slug: string): Promise<void> {
  const pending = await getProjectUserProjectInvitations(slug);
  const batch = writeBatch(db);
  batch.update(projectRef(slug), { deletedAt: serverTimestamp() });
  for (const inv of pending) {
    batch.update(invitationRef(slug, inv.toUserId), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function updateProjectTitle(
  slug: string,
  title: string,
): Promise<void> {
  await updateDoc(projectRef(slug), { title });
}

// -- Members --

export async function getProjectMembers(
  slug: string,
): Promise<ProjectMemberDoc[]> {
  const snap = await getDocs(collection(db, "projects", slug, "members"));
  return snap.docs.map((d) => zProjectMemberDoc.parse(d.data()));
}

export async function getMemberRole(
  slug: string,
  uid: string,
): Promise<UserProjectRole | undefined> {
  const snap = await getDoc(memberRef(slug, uid));
  return snap.exists() ? zProjectMemberDoc.parse(snap.data()).role : undefined;
}

export async function updateProjectMemberRole(
  slug: string,
  uid: string,
  role: UserProjectRole,
): Promise<void> {
  await updateDoc(memberRef(slug, uid), { role });
}

export async function removeProjectMember(
  slug: string,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(memberRef(slug, uid));
  batch.update(projectRef(slug), { memberIds: arrayRemove(uid) });
  await batch.commit();
}

// -- Invitations --

// One invitation per (project, invitee), keyed by the invitee, so security
// rules can find it when the invitee accepts.
function invitationRef(projectId: string, toUserId: string) {
  return doc(db, "projects", projectId, "invitations", toUserId);
}

function parseInvitation(snap: {
  id: string;
  data(): Record<string, unknown>;
}): WithId<UserProjectInvitationDoc> {
  return { id: snap.id, ...zUserProjectInvitationDoc.parse(snap.data()) };
}

/** Re-inviting overwrites any earlier invitation to the same user. */
export async function createUserProjectInvitation(
  data: UserProjectInvitationData,
): Promise<void> {
  await setDoc(invitationRef(data.projectId, data.toUserId), {
    ...zUserProjectInvitationData.parse(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });
}

export async function getPendingUserProjectInvitations(
  toUserId: string,
): Promise<WithId<UserProjectInvitationDoc>[]> {
  const snap = await getDocs(
    query(
      collectionGroup(db, "invitations"),
      where("toUserId", "==", toUserId),
      where("accepted", "==", null),
      where("deletedAt", "==", null),
    ),
  );
  return snap.docs.map(parseInvitation);
}

export async function getProjectUserProjectInvitations(
  projectId: string,
): Promise<WithId<UserProjectInvitationDoc>[]> {
  const snap = await getDocs(
    query(
      collection(db, "projects", projectId, "invitations"),
      where("deletedAt", "==", null),
    ),
  );
  return snap.docs.map(parseInvitation);
}

/**
 * The invitee closes the invitation, creates their own member document and
 * adds themselves to `memberIds` — one batch, so rules see all three at once.
 */
export async function acceptUserProjectInvitation(
  invitation: UserProjectInvitationDoc,
  displayName: string,
): Promise<void> {
  const { projectId, toUserId } = invitation;
  const batch = writeBatch(db);
  batch.update(invitationRef(projectId, toUserId), {
    accepted: true,
    updatedAt: serverTimestamp(),
    deletedAt: serverTimestamp(),
  });
  batch.set(memberRef(projectId, toUserId), {
    ...zProjectMemberData.parse({
      uid: toUserId,
      role: invitation.role,
      displayName,
      addedBy: invitation.fromUserId,
    }),
    addedAt: serverTimestamp(),
  });
  batch.update(projectRef(projectId), { memberIds: arrayUnion(toUserId) });
  await batch.commit();
}

export async function denyUserProjectInvitation(
  projectId: string,
  toUserId: string,
): Promise<void> {
  await updateDoc(invitationRef(projectId, toUserId), {
    accepted: false,
    updatedAt: serverTimestamp(),
    deletedAt: serverTimestamp(),
  });
}

export async function cancelUserProjectInvitation(
  projectId: string,
  toUserId: string,
): Promise<void> {
  await updateDoc(invitationRef(projectId, toUserId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Mirrors `FindUserForInviteResult` in functions/src/findUserForInvite.ts. */
export type FindUserForInviteResult =
  | { status: "found"; uid: string; displayName: string }
  | { status: "not-found" }
  | { status: "ambiguous" };

/**
 * Looks a user up by display name. Runs server-side: `users` is not readable
 * by other users, and display names live in Firebase Auth.
 */
export async function findUserForInvite(
  projectId: string,
  displayName: string,
): Promise<FindUserForInviteResult> {
  const call = httpsCallable<
    { projectId: string; displayName: string },
    FindUserForInviteResult
  >(functions, "findUserForInvite");
  return (await call({ projectId, displayName })).data;
}

// -- Score links --

/** A score of another project, used by this one (collab-flow §2.1.3). */
function scoreLinkRef(projectId: string, scoreId: string) {
  return doc(db, "projects", projectId, "scoreLinks", scoreId);
}

export async function getProjectScoreLinks(
  projectId: string,
): Promise<ScoreLinkDoc[]> {
  const snap = await getDocs(collection(db, "projects", projectId, "scoreLinks"));
  return snap.docs
    .map((d) => zScoreLinkDoc.parse(d.data()))
    .filter((link) => !link.deletedAt);
}

// -- Songbooks --

export const newSongbookRevisionId = (title: string): string =>
  newRevisionId(revisionSlug(title, new Date()));

/** Deterministic, so a slug is unique within its project. */
export function songbookId(projectId: string, slug: string): string {
  return `${projectId}~${slug}`;
}

function songbookRef(id: string) {
  return doc(db, "songbooks", id);
}

function songbookRevisionRef(songbookId: string, revisionId: string) {
  return doc(db, "songbooks", songbookId, "songbookRevisions", revisionId);
}

const isPermissionDenied = (err: unknown) =>
  err instanceof FirebaseError && err.code === "permission-denied";

/**
 * `null` when it doesn't exist or the caller may not see it (unpublished and
 * not a member) — the two are indistinguishable by design.
 */
export async function getSongbook(
  projectId: string,
  slug: string,
): Promise<WithId<SongbookDoc> | null> {
  try {
    const snap = await getDoc(songbookRef(songbookId(projectId, slug)));
    return snap.exists()
      ? { id: snap.id, ...zSongbookDoc.parse(snap.data()) }
      : null;
  } catch (err) {
    if (isPermissionDenied(err)) {
      return null;
    }
    throw err;
  }
}

/**
 * A project's live songbooks. Non-members must pass `publishedOnly`: the
 * rules only let them query what they can read.
 */
export async function getProjectSongbooks(
  projectId: string,
  { publishedOnly }: { publishedOnly: boolean },
): Promise<WithId<SongbookDoc>[]> {
  const constraints = [
    where("projectId", "==", projectId),
    where("deletedAt", "==", null),
    ...(publishedOnly ? [where("isPublished", "==", true)] : []),
  ];
  const snap = await getDocs(query(collection(db, "songbooks"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...zSongbookDoc.parse(d.data()) }));
}

export async function getSongbookRevision(
  songbookId: string,
  revisionId: string,
): Promise<WithId<SongbookRevisionDoc> | null> {
  const snap = await getDoc(songbookRevisionRef(songbookId, revisionId));
  return snap.exists()
    ? { id: snap.id, ...zSongbookRevisionDoc.parse(snap.data()) }
    : null;
}

/** Newest first. Members only. */
export async function getSongbookRevisions(
  songbookId: string,
): Promise<WithId<SongbookRevisionDoc>[]> {
  const snap = await getDocs(
    collection(db, "songbooks", songbookId, "songbookRevisions"),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...zSongbookRevisionDoc.parse(d.data()) }))
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

/**
 * Creates the songbook with its first revision, linking in the same batch
 * any scores that belong to other projects (`links`).
 */
export async function createSongbook(input: {
  projectId: string;
  slug: string;
  title: string;
  content: SongbookRevisionContent;
  createdBy: string;
  links: { scoreId: string; sourceProjectId: string }[];
}): Promise<string> {
  const id = songbookId(input.projectId, input.slug);
  const revisionId = newSongbookRevisionId(input.title);
  const batch = writeBatch(db);
  for (const link of input.links) {
    batch.set(scoreLinkRef(input.projectId, link.scoreId), {
      ...zScoreLinkData.parse({ ...link, addedBy: input.createdBy }),
      addedAt: serverTimestamp(),
      deletedAt: null,
    });
  }
  batch.set(songbookRef(id), {
    ...zSongbookData.parse({
      title: input.title,
      projectId: input.projectId,
      slug: input.slug,
      currentRevisionId: revisionId,
      isPublished: false,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });
  batch.set(songbookRevisionRef(id, revisionId), {
    ...zSongbookRevisionData.parse({
      ...input.content,
      revisionNumber: 1,
      prevRevisionId: null,
      createdBy: input.createdBy,
      note: "",
    }),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return id;
}

/**
 * Copy-on-write: a new revision on top of the current one, which it then
 * replaces as `currentRevisionId` — in one transaction, so concurrent edits
 * retry instead of overwriting (collab-flow §5.5).
 */
export async function createSongbookRevision(
  id: string,
  content: SongbookRevisionContent,
  input: {
    createdBy: string;
    note: string;
    // Known up front when files are uploaded under the revision's path first.
    revisionId?: string;
  },
): Promise<string> {
  return runTransaction(db, async (tx) => {
    const songbookSnap = await tx.get(songbookRef(id));
    const songbook = zSongbookDoc.parse(songbookSnap.data());
    const prevSnap = await tx.get(
      songbookRevisionRef(id, songbook.currentRevisionId),
    );
    const prev = zSongbookRevisionDoc.parse(prevSnap.data());
    const revisionId =
      input.revisionId ?? newSongbookRevisionId(songbook.title);
    tx.set(songbookRevisionRef(id, revisionId), {
      ...zSongbookRevisionData.parse({
        ...content,
        revisionNumber: prev.revisionNumber + 1,
        prevRevisionId: songbook.currentRevisionId,
        createdBy: input.createdBy,
        note: input.note,
      }),
      createdAt: serverTimestamp(),
    });
    tx.update(songbookRef(id), {
      currentRevisionId: revisionId,
      updatedAt: serverTimestamp(),
    });
    return revisionId;
  });
}
