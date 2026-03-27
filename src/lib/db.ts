import {
  collection,
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
  zSongDoc,
  zSongData,
  zRevisionDoc,
  zRevisionData,
  zProjectDoc,
  zProjectData,
  type SongDoc,
  type SongData,
  type RevisionDoc,
  type RevisionData,
  type ProjectDoc,
  type ProjectData,
} from "../../firestore-types";

export type WithId<T> = T & { id: string };

// -- Reads --

export async function getSong(id: string): Promise<WithId<SongDoc> | null> {
  const snap = await getDoc(doc(db, "songs", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...zSongDoc.parse(snap.data()) };
}

export async function getRevision(
  songId: string,
  revisionId: string,
): Promise<WithId<RevisionDoc> | null> {
  const snap = await getDoc(doc(db, "songs", songId, "revisions", revisionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...zRevisionDoc.parse(snap.data()) };
}

export async function getSongRevisions(
  songId: string,
): Promise<WithId<RevisionDoc>[]> {
  const snap = await getDocs(collection(db, "songs", songId, "revisions"));
  return snap.docs
    .map((d) => ({ id: d.id, ...zRevisionDoc.parse(d.data()) }))
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

export async function getProject(id: string): Promise<WithId<ProjectDoc> | null> {
  const snap = await getDoc(doc(db, "projects", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...zProjectDoc.parse(snap.data()) };
}

export async function getUserSongs(uid: string): Promise<WithId<SongDoc>[]> {
  const snap = await getDocs(
    query(collection(db, "songs"), where("uploadedBy", "==", uid)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...zSongDoc.parse(d.data()) }))
    .filter((s) => !s.deletedAt);
}

export async function getUserProjects(uid: string): Promise<WithId<ProjectDoc>[]> {
  const [ownedSnap, collabSnap] = await Promise.all([
    getDocs(query(collection(db, "projects"), where("ownerId", "==", uid))),
    getDocs(query(collection(db, "projects"), where("collaboratorIds", "array-contains", uid))),
  ]);
  const seen = new Map<string, WithId<ProjectDoc>>();
  for (const d of [...ownedSnap.docs, ...collabSnap.docs]) {
    if (!seen.has(d.id))
      seen.set(d.id, { id: d.id, ...zProjectDoc.parse(d.data()) });
  }
  return Array.from(seen.values());
}

// -- Writes --

export async function createSong(id: string, data: SongData): Promise<void> {
  await setDoc(doc(db, "songs", id), {
    ...zSongData.parse(data),
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
}

export async function updateSong(id: string, data: Partial<SongData>): Promise<void> {
  await updateDoc(doc(db, "songs", id), data);
}

export async function softDeleteSong(id: string): Promise<void> {
  await updateDoc(doc(db, "songs", id), { deletedAt: serverTimestamp() });
}

export async function createRevision(
  songId: string,
  revisionId: string,
  data: RevisionData,
): Promise<void> {
  await setDoc(doc(db, "songs", songId, "revisions", revisionId), {
    ...zRevisionData.parse(data),
    uploadedAt: serverTimestamp(),
  });
}

export async function updateRevision(
  songId: string,
  revisionId: string,
  data: Partial<RevisionData>,
): Promise<void> {
  await updateDoc(doc(db, "songs", songId, "revisions", revisionId), data);
}

export async function createProject(id: string, data: ProjectData): Promise<void> {
  await setDoc(doc(db, "projects", id), {
    ...zProjectData.parse(data),
    createdAt: serverTimestamp(),
  });
}
