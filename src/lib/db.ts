import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteField,
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
import { db } from "../firebase";
import {
  zScoreDoc,
  zScoreData,
  zScoreRevisionDoc,
  zScoreRevisionData,
  zLegacyRevisionData,
  zProjectDoc,
  zProjectData,
  zProjectCreateData,
  zUserProjectInvitationDoc,
  zUserProjectInvitationData,
  type ScoreDoc,
  type ScoreRevisionDoc,
  type ProjectDoc,
  type ProjectCreateData,
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

export async function createProject(
  slug: string,
  data: ProjectCreateData,
): Promise<void> {
  const parsed = zProjectCreateData.parse(data);
  const memberIds = Object.keys(parsed.members);
  await setDoc(projectRef(slug), {
    ...zProjectData.parse({ ...parsed, slug, memberIds }),
    createdAt: serverTimestamp(),
  });
}

export async function updateProjectTitle(
  slug: string,
  title: string,
): Promise<void> {
  await updateDoc(projectRef(slug), { title });
}

export async function addProjectMember(
  slug: string,
  uid: string,
  role: UserProjectRole,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(projectRef(slug), {
    [`members.${uid}`]: role,
    memberIds: arrayUnion(uid),
  });
  await batch.commit();
}

export async function removeProjectMember(
  slug: string,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(projectRef(slug), {
    [`members.${uid}`]: deleteField(),
    memberIds: arrayRemove(uid),
  });
  await batch.commit();
}

export async function updateProjectMemberRole(
  slug: string,
  uid: string,
  role: UserProjectRole,
): Promise<void> {
  await updateDoc(projectRef(slug), { [`members.${uid}`]: role });
}

// -- Invitations --

function invitationsCol() {
  return collection(db, "invitations");
}

export async function createUserProjectInvitation(
  data: UserProjectInvitationData,
): Promise<string> {
  const ref = await addDoc(invitationsCol(), {
    ...zUserProjectInvitationData.parse(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });
  return ref.id;
}

export async function getPendingUserProjectInvitations(
  toUserId: string,
): Promise<WithId<UserProjectInvitationDoc>[]> {
  const snap = await getDocs(
    query(
      invitationsCol(),
      where("toUserId", "==", toUserId),
      where("accepted", "==", null),
      where("deletedAt", "==", null),
    ),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...zUserProjectInvitationDoc.parse(d.data()),
  }));
}

export async function getProjectUserProjectInvitations(
  projectId: string,
): Promise<WithId<UserProjectInvitationDoc>[]> {
  const snap = await getDocs(
    query(
      invitationsCol(),
      where("projectId", "==", projectId),
      where("deletedAt", "==", null),
    ),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...zUserProjectInvitationDoc.parse(d.data()),
  }));
}

export async function acceptUserProjectInvitation(id: string): Promise<void> {
  const snap = await getDoc(doc(invitationsCol(), id));
  if (!snap.exists()) {
    throw new Error(`Invitation ${id} not found`);
  }
  const inv = zUserProjectInvitationDoc.parse(snap.data());

  const batch = writeBatch(db);
  batch.update(doc(invitationsCol(), id), {
    accepted: true,
    updatedAt: serverTimestamp(),
    deletedAt: serverTimestamp(),
  });
  batch.update(projectRef(inv.projectId), {
    [`members.${inv.toUserId}`]: inv.role,
    memberIds: arrayUnion(inv.toUserId),
  });
  await batch.commit();
}

export async function denyUserProjectInvitation(id: string): Promise<void> {
  await updateDoc(doc(invitationsCol(), id), {
    accepted: false,
    updatedAt: serverTimestamp(),
    deletedAt: serverTimestamp(),
  });
}

export async function cancelUserProjectInvitation(id: string): Promise<void> {
  await updateDoc(doc(invitationsCol(), id), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUserByEmail(
  email: string,
): Promise<WithId<{ displayName: string; email: string }> | null> {
  const snap = await getDocs(
    query(collection(db, "users"), where("email", "==", email)),
  );
  if (snap.empty) {
    return null;
  }
  const d = snap.docs[0];
  return {
    id: d.id,
    email: d.data().email as string,
    displayName: d.data().displayName as string,
  };
}
