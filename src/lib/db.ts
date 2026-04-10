import {
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
} from "firebase/firestore";
import { db } from "../firebase";
import {
  zScoreDoc,
  zScoreData,
  zRevisionDoc,
  zRevisionData,
  zProjectDoc,
  zProjectData,
  type ScoreDoc,
  type ScoreData,
  type RevisionDoc,
  type RevisionData,
  type ProjectDoc,
  type ProjectData,
} from "../../firestore-types";
import { SCORES_COLLECTION } from "../../constants";

export type WithId<T> = T & { id: string };

// -- Reads --

export async function getScore(id: string): Promise<WithId<ScoreDoc> | null> {
  const snap = await getDoc(doc(db, SCORES_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...zScoreDoc.parse(snap.data()) };
}

export async function getRevision(
  scoreId: string,
  revisionId: string,
): Promise<WithId<RevisionDoc> | null> {
  const snap = await getDoc(doc(db, SCORES_COLLECTION, scoreId, "revisions", revisionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...zRevisionDoc.parse(snap.data()) };
}

export async function getScoreRevisions(
  scoreId: string,
): Promise<WithId<RevisionDoc>[]> {
  const snap = await getDocs(collection(db, SCORES_COLLECTION, scoreId, "revisions"));
  return snap.docs
    .map((d) => ({ id: d.id, ...zRevisionDoc.parse(d.data()) }))
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

export async function getProject(
  id: string,
): Promise<WithId<ProjectDoc> | null> {
  const snap = await getDoc(doc(db, "projects", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...zProjectDoc.parse(snap.data()) };
}

export async function getUserScores(uid: string): Promise<WithId<ScoreDoc>[]> {
  const snap = await getDocs(
    query(collection(db, SCORES_COLLECTION), where("uploadedBy", "==", uid)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...zScoreDoc.parse(d.data()) }))
    .filter((s) => !s.deletedAt);
}

export async function getUserProjects(
  uid: string,
): Promise<WithId<ProjectDoc>[]> {
  const [ownedSnap, collabSnap] = await Promise.all([
    getDocs(query(collection(db, "projects"), where("ownerId", "==", uid))),
    getDocs(
      query(
        collection(db, "projects"),
        where("collaboratorIds", "array-contains", uid),
      ),
    ),
  ]);
  const seen = new Map<string, WithId<ProjectDoc>>();
  for (const d of [...ownedSnap.docs, ...collabSnap.docs]) {
    if (!seen.has(d.id))
      seen.set(d.id, { id: d.id, ...zProjectDoc.parse(d.data()) });
  }
  return Array.from(seen.values());
}

export async function getAllProjects(): Promise<WithId<ProjectDoc>[]> {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map((d) => ({ id: d.id, ...zProjectDoc.parse(d.data()) }));
}

export async function getAllScores(): Promise<WithId<ScoreDoc>[]> {
  const snap = await getDocs(collection(db, SCORES_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...zScoreDoc.parse(d.data()) }));
}

export async function getLatestRevisions(): Promise<
  (WithId<RevisionDoc> & { scoreId: string })[]
> {
  const snap = await getDocs(
    query(collectionGroup(db, "revisions"), where("isLatest", "==", true)),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    scoreId: d.ref.parent.parent!.id,
    ...zRevisionDoc.parse(d.data()),
  }));
}

// -- Writes --

export async function createScore(id: string, data: ScoreData): Promise<void> {
  await setDoc(doc(db, SCORES_COLLECTION, id), {
    ...zScoreData.parse(data),
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
}

export async function updateScore(
  id: string,
  data: Partial<ScoreData>,
): Promise<void> {
  await updateDoc(doc(db, SCORES_COLLECTION, id), data);
}

export async function softDeleteScore(id: string): Promise<void> {
  await updateDoc(doc(db, SCORES_COLLECTION, id), { deletedAt: serverTimestamp() });
}

export async function createRevision(
  scoreId: string,
  revisionId: string,
  data: RevisionData,
): Promise<void> {
  await setDoc(doc(db, SCORES_COLLECTION, scoreId, "revisions", revisionId), {
    ...zRevisionData.parse(data),
    uploadedAt: serverTimestamp(),
  });
}

export async function updateRevision(
  scoreId: string,
  revisionId: string,
  data: Partial<RevisionData>,
): Promise<void> {
  await updateDoc(doc(db, SCORES_COLLECTION, scoreId, "revisions", revisionId), data);
}

export async function createProject(
  id: string,
  data: ProjectData,
): Promise<void> {
  await setDoc(doc(db, "projects", id), {
    ...zProjectData.parse(data),
    createdAt: serverTimestamp(),
  });
}
