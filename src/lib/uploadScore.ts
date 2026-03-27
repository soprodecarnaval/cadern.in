import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import { slugify } from "./slugify";
import type { ParsedScore } from "./parseUploadedFiles";
import type { User } from "firebase/auth";

const DEFAULT_PROJECT_PREFIX = "Acervo @";

export function defaultProjectTitle(displayName: string): string {
  return `${DEFAULT_PROJECT_PREFIX}${displayName}`;
}

export interface UploadProgress {
  stage: "preparing" | "uploading" | "writing-firestore" | "done";
  filesUploaded: number;
  filesTotal: number;
}

export type OnProgress = (progress: UploadProgress) => void;

async function ensureDefaultProject(user: User): Promise<string> {
  const title = defaultProjectTitle(user.displayName ?? user.email ?? "user");
  const projectId = slugify(title);
  const projectRef = doc(db, "projects", projectId);
  const existing = await getDoc(projectRef);
  if (!existing.exists()) {
    await setDoc(projectRef, {
      title,
      ownerId: user.uid,
      collaboratorIds: [],
      createdAt: serverTimestamp(),
    });
  }
  return projectId;
}

async function getNextRevisionNumber(songId: string): Promise<number> {
  const revisionsRef = collection(db, "songs", songId, "revisions");
  const snap = await getDocs(revisionsRef);
  return snap.size + 1;
}

export async function uploadScore(
  parsed: ParsedScore,
  projectId: string,
  user: User,
  onProgress?: OnProgress,
  existingSongId?: string,
): Promise<string> {
  const songId = existingSongId ?? `${projectId}-${slugify(parsed.title)}`;
  const revisionNumber = existingSongId
    ? await getNextRevisionNumber(songId)
    : 1;
  const revId = String(revisionNumber);
  const storageBase = `songs/${songId}/${revId}`;

  const filesTotal = parsed.fileMap.size;
  let filesUploaded = 0;

  onProgress?.({
    stage: "uploading",
    filesUploaded: 0,
    filesTotal,
  });

  // Upload all files to Storage
  const storagePaths = new Map<string, string>();

  for (const [key, file] of parsed.fileMap) {
    let storagePath: string;
    if (key === "mscz") {
      storagePath = `${storageBase}/score.mscz`;
    } else if (key === "metajson") {
      storagePath = `${storageBase}/score.metajson`;
    } else if (key === "midi") {
      storagePath = `${storageBase}/score.midi`;
    } else {
      // parts/... paths are already relative
      storagePath = `${storageBase}/${key}`;
    }

    storagePaths.set(key, storagePath);
    const storageRef = ref(storage, storagePath);
    const buffer = await file.arrayBuffer();
    await uploadBytes(storageRef, buffer, { contentType: file.type || "application/octet-stream" });

    filesUploaded++;
    onProgress?.({ stage: "uploading", filesUploaded, filesTotal });
  }

  onProgress?.({
    stage: "writing-firestore",
    filesUploaded: filesTotal,
    filesTotal,
  });

  // Build revision parts with storage paths
  const revisionParts = parsed.parts.map((part) => ({
    name: part.name,
    instrument: part.instrument,
    svg: part.svg.map((svgKey) => storagePaths.get(svgKey) ?? svgKey),
    midi: storagePaths.get(`parts/${part.name}.midi`) ?? part.midi,
  }));

  // If updating, mark previous revision as not latest
  if (existingSongId && revisionNumber > 1) {
    const prevRevRef = doc(
      db,
      "songs",
      songId,
      "revisions",
      String(revisionNumber - 1),
    );
    await updateDoc(prevRevRef, { isLatest: false });
  }

  // Write revision doc
  const revisionRef = doc(db, "songs", songId, "revisions", revId);
  await setDoc(revisionRef, {
    revisionNumber,
    uploadedBy: user.uid,
    uploadedAt: serverTimestamp(),
    mscz: storagePaths.get("mscz") ?? "",
    metajson: storagePaths.get("metajson") ?? "",
    midi: storagePaths.get("midi") ?? "",
    parts: revisionParts,
    notes: "",
    isLatest: true,
  });

  // Write or update song doc
  const songRef = doc(db, "songs", songId);
  if (existingSongId) {
    await updateDoc(songRef, { latestRevisionId: revId });
  } else {
    await setDoc(songRef, {
      title: parsed.title,
      composer: parsed.composer,
      sub: parsed.sub,
      tags: parsed.tags,
      projectId,
      uploadedBy: user.uid,
      latestRevisionId: revId,
      createdAt: serverTimestamp(),
      deletedAt: null,
    });
  }

  onProgress?.({ stage: "done", filesUploaded: filesTotal, filesTotal });
  return songId;
}

export async function getOrCreateDefaultProject(user: User): Promise<string> {
  return ensureDefaultProject(user);
}

export async function getUserProjects(
  uid: string,
): Promise<{ id: string; title: string }[]> {
  const ownedQuery = query(
    collection(db, "projects"),
    where("ownerId", "==", uid),
  );
  const collabQuery = query(
    collection(db, "projects"),
    where("collaboratorIds", "array-contains", uid),
  );

  const [ownedSnap, collabSnap] = await Promise.all([
    getDocs(ownedQuery),
    getDocs(collabQuery),
  ]);

  const projects = new Map<string, string>();
  for (const d of [...ownedSnap.docs, ...collabSnap.docs]) {
    projects.set(d.id, d.data().title);
  }

  return Array.from(projects, ([id, title]) => ({ id, title }));
}

export async function softDeleteSong(songId: string): Promise<void> {
  const songRef = doc(db, "songs", songId);
  await updateDoc(songRef, { deletedAt: serverTimestamp() });
}
