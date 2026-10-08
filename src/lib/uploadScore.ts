import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { slugify } from "./slugify";
import { displayNameOf } from "./displayName";
import type { ParsedScore } from "./parseUploadedFiles";
import type { User } from "firebase/auth";
import {
  commitScoreRevision,
  createProject,
  createScore,
  getProject,
  softDeleteScore,
} from "./db";
import { newRevisionId, revisionSlug } from "./revisionId";

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
    await createProject(
      slug,
      { title },
      { uid: user.uid, displayName: displayNameOf(user) },
    );
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
  const metadata = {
    title: parsed.title,
    composer: parsed.composer,
    sub: parsed.sub,
    tags: parsed.tags,
  };
  // The revision's place in the chain (number, predecessor) is settled by the
  // transaction in commitScoreRevision; the id only has to be unique.
  const slug = revisionSlug(parsed.title, new Date());
  const revId = newRevisionId(slug);
  // `scores/`, not `songs/`: the collection was renamed by migration
  // 202604201809_songs_to_scores, which moved the objects too.
  const storageBase = `scores/${scoreId}/${revId}`;

  // The score document is written before any file is. Both rule sets read it
  // to resolve the project: storage.rules to authorise the upload,
  // firestore.rules to authorise creating the revision. Creating it last — as
  // this used to — left both with nothing to read on a first upload.
  const filesTotal = parsed.fileMap.size;
  const isNewScore = !existingScoreId;
  if (isNewScore) {
    await createScore(scoreId, {
      projectId,
      uploadedBy: user.uid,
      metadata,
    });
  }

  try {
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
      // `name` is the authored part name and may contain anything, including a
      // path separator — keys are built from `basename`, never from it.
      name: part.name,
      instrument: part.instrument,
      svg: part.svg.map((svgKey) => storageFiles.get(svgKey) ?? missing(svgKey)),
      midi: storageFiles.get(part.midi) ?? missing(part.midi),
    }));

    await commitScoreRevision(scoreId, revId, {
      uploadedBy: user.uid,
      slug,
      metadata,
      origin: { type: "upload" },
      mscz: storageFiles.get("mscz") ?? missing("mscz"),
      metajson: storageFiles.get("metajson") ?? missing("metajson"),
      midi: storageFiles.get("midi") ?? missing("midi"),
      parts: revisionParts,
      notes: "",
    });
  } catch (error) {
    // A score created above but never given a revision would list without
    // opening. Soft, not hard: firestore.rules lets its creator soft-delete a
    // score that has no revision yet, and nobody hard-delete one.
    if (isNewScore) {
      await softDeleteScore(scoreId).catch(() => undefined);
    }
    throw error;
  }

  onProgress?.({ stage: "done", filesUploaded: filesTotal, filesTotal });
  return scoreId;
}
