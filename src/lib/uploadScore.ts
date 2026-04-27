import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { slugify } from "./slugify";
import type { ParsedScore } from "./parseUploadedFiles";
import type { User } from "firebase/auth";
import {
  createProject,
  createRevision,
  createScore,
  getScoreRevisions,
  getProject,
  updateRevision,
  updateScore,
} from "./db";

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

export async function getOrCreateDefaultProject(user: User): Promise<string> {
  const title = defaultProjectTitle(user.displayName ?? user.email ?? "user");
  const slug = slugify(title);
  const existing = await getProject(slug);
  if (!existing) {
    await createProject(slug, {
      title,
      members: { [user.uid]: "owner" },
    });
  }
  return slug;
}

export async function uploadScore(
  parsed: ParsedScore,
  projectId: string,
  user: User,
  onProgress?: OnProgress,
  existingScoreId?: string,
): Promise<string> {
  const scoreId = existingScoreId ?? `${projectId}-${slugify(parsed.title)}`;
  const revisionNumber = existingScoreId
    ? (await getScoreRevisions(scoreId)).length + 1
    : 1;
  const revId = String(revisionNumber);
  const storageBase = `songs/${scoreId}/${revId}`;

  const filesTotal = parsed.fileMap.size;
  let filesUploaded = 0;

  onProgress?.({ stage: "uploading", filesUploaded: 0, filesTotal });

  const storageFiles = new Map<string, { path: string; url: string }>();

  for (const [key, file] of parsed.fileMap) {
    let storagePath: string;
    if (key === "mscz") {
      storagePath = `${storageBase}/score.mscz`;
    } else if (key === "metajson") {
      storagePath = `${storageBase}/score.metajson`;
    } else if (key === "midi") {
      storagePath = `${storageBase}/score.midi`;
    } else {
      storagePath = `${storageBase}/${key}`;
    }

    const storageRef = ref(storage, storagePath);
    const buffer = await file.arrayBuffer();
    await uploadBytes(storageRef, buffer, {
      contentType: file.type || "application/octet-stream",
    });
    const url = await getDownloadURL(storageRef);
    storageFiles.set(key, { path: storagePath, url });

    filesUploaded++;
    onProgress?.({ stage: "uploading", filesUploaded, filesTotal });
  }

  onProgress?.({
    stage: "writing-firestore",
    filesUploaded: filesTotal,
    filesTotal,
  });

  const missing = (key: string) => ({ path: key, url: "" });

  const revisionParts = parsed.parts.map((part) => ({
    name: part.name,
    instrument: part.instrument,
    svg: part.svg.map((svgKey) => storageFiles.get(svgKey) ?? missing(svgKey)),
    midi: storageFiles.get(`parts/${part.name}.midi`) ?? missing(part.midi),
  }));

  if (existingScoreId && revisionNumber > 1) {
    await updateRevision(scoreId, String(revisionNumber - 1), {
      isLatest: false,
    });
  }

  await createRevision(scoreId, revId, {
    revisionNumber,
    uploadedBy: user.uid,
    mscz: storageFiles.get("mscz") ?? missing("mscz"),
    metajson: storageFiles.get("metajson") ?? missing("metajson"),
    midi: storageFiles.get("midi") ?? missing("midi"),
    parts: revisionParts,
    notes: "",
    isLatest: true,
  });

  if (existingScoreId) {
    await updateScore(scoreId, { latestRevisionId: revId });
  } else {
    await createScore(scoreId, {
      title: parsed.title,
      composer: parsed.composer,
      sub: parsed.sub,
      tags: parsed.tags,
      projectId,
      uploadedBy: user.uid,
      latestRevisionId: revId,
    });
  }

  onProgress?.({ stage: "done", filesUploaded: filesTotal, filesTotal });
  return scoreId;
}
