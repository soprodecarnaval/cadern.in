import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import {
  zScoreDoc,
  zScoreData,
  zScoreRevisionDoc,
  zScoreRevisionData,
  zLegacyRevisionData,
  zProjectDoc,
  zProjectData,
  zProjectCreateData,
  zProjectMemberData,
  zProjectMemberDoc,
  zUserProjectInvitationDoc,
  zUserProjectInvitationData,
  type ScoreDoc,
  type ScoreRevisionDoc,
  type ProjectDoc,
  type ProjectCreateData,
  type ProjectMemberDoc,
  type UserProjectRole,
  type UserProjectInvitationDoc,
} from "../../types/docs";
import type z from "zod";

type ScoreData = z.infer<typeof zScoreData>;
type ScoreRevisionData = z.infer<typeof zScoreRevisionData>;
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
// (collab-flow M9). Every write goes to both; reads stay on the legacy one —
// the only one flag-off code knows — until each reader moves to the new model.
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

export async function createScore(id: string, data: ScoreData): Promise<void> {
  await setDoc(doc(db, "scores", id), {
    ...zScoreData.parse(data),
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
}

export async function updateScore(
  id: string,
  data: Partial<ScoreData>,
): Promise<void> {
  await updateDoc(doc(db, "scores", id), data);
}

export async function softDeleteScore(id: string): Promise<void> {
  await updateDoc(doc(db, "scores", id), {
    deletedAt: serverTimestamp(),
  });
}

/**
 * Writes the revision to both subcollections in one batch. The legacy copy also
 * carries `isLatest`, which moves off `prevRevisionId`.
 */
export async function createScoreRevision(
  scoreId: string,
  revisionId: string,
  data: ScoreRevisionData,
  prevRevisionId: string | null,
): Promise<void> {
  const parsed = zScoreRevisionData.parse(data);
  const batch = writeBatch(db);
  batch.set(doc(db, "scores", scoreId, SCORE_REVISIONS, revisionId), {
    ...parsed,
    uploadedAt: serverTimestamp(),
  });
  batch.set(doc(db, "scores", scoreId, LEGACY_REVISIONS, revisionId), {
    ...zLegacyRevisionData.parse({ ...parsed, isLatest: true }),
    uploadedAt: serverTimestamp(),
  });
  if (prevRevisionId) {
    batch.update(doc(db, "scores", scoreId, LEGACY_REVISIONS, prevRevisionId), {
      isLatest: false,
    });
  }
  await batch.commit();
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

export async function getUserMemberProjects(
  uid: string,
): Promise<WithId<ProjectDoc>[]> {
  const snap = await getDocs(
    query(
      collection(db, "projects"),
      where("memberIds", "array-contains", uid),
    ),
  );
  return snap.docs.map(parseProject);
}

export async function getAllProjects(): Promise<WithId<ProjectDoc>[]> {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map(parseProject);
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
