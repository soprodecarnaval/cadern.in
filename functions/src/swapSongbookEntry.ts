import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export interface SwapRequest {
  songbookId: string;
  scoreId: string;
  forkId: string;
}

const EDITOR_ROLES = ["owner", "admin", "editor"];

/**
 * Replaces a songbook entry's score with its fork, in a new songbook version
 * that keeps the entry's place and number and pins the fork's latest version.
 * Runs here because editors may change only pins under the rules, which cannot
 * check a change to one list item; this checks exactly that one change.
 * @param {string | undefined} uid The signed-in caller.
 * @param {unknown} data The request payload.
 * @return {Promise<{revisionId: string}>} The new songbook version.
 */
export async function swapSongbookEntryHandler(
  uid: string | undefined,
  data: unknown,
): Promise<{ revisionId: string }> {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to change a songbook.");
  }
  const { songbookId, scoreId, forkId } = (data ?? {}) as Partial<SwapRequest>;
  if (!songbookId || !scoreId || !forkId) {
    throw new HttpsError("invalid-argument", "songbookId, scoreId, forkId.");
  }

  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const songbookRef = db.collection("songbooks").doc(songbookId);
    const songbook = await tx.get(songbookRef);
    if (!songbook.exists || songbook.get("deletedAt")) {
      throw new HttpsError("not-found", "Songbook not found.");
    }
    const projectId = songbook.get("projectId") as string;
    const projectRef = db.collection("projects").doc(projectId);
    const [project, member, fork] = await Promise.all([
      tx.get(projectRef),
      tx.get(projectRef.collection("members").doc(uid)),
      tx.get(db.collection("scores").doc(forkId)),
    ]);
    if (!project.exists || project.get("deletedAt") ||
        !EDITOR_ROLES.includes(member.get("role"))) {
      throw new HttpsError("permission-denied", "Only editors can swap.");
    }
    if (!fork.exists || fork.get("deletedAt") ||
        fork.get("projectId") !== projectId ||
        fork.get("forkedFrom.scoreId") !== scoreId ||
        !fork.get("latestRevisionId")) {
      throw new HttpsError(
        "failed-precondition",
        "Not a live fork of this score in the songbook's project.",
      );
    }

    const revisions = songbookRef.collection("songbookRevisions");
    const current = await tx.get(
      revisions.doc(songbook.get("currentRevisionId")),
    );
    const pins = { ...(current.get("pins") as Record<string, string>) };
    if (!pins[scoreId]) {
      throw new HttpsError("failed-precondition", "Score isn't in it.");
    }
    if (pins[forkId]) {
      throw new HttpsError("failed-precondition", "Fork is already in it.");
    }
    delete pins[scoreId];
    pins[forkId] = fork.get("latestRevisionId");

    const revision = revisions.doc();
    tx.create(revision, {
      entries: (current.get("entries") as { scoreId?: string }[]).map((e) =>
        e.scoreId === scoreId ? { ...e, scoreId: forkId } : e),
      pins,
      covers: current.get("covers") ?? {},
      revisionNumber: (current.get("revisionNumber") as number) + 1,
      prevRevisionId: current.id,
      createdBy: uid,
      note: `troca: ${
        fork.get("metadataOverride.title") ??
        fork.get("cachedMetadata.title") ??
        fork.get("title")
      } → derivação`,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(songbookRef, {
      currentRevisionId: revision.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { revisionId: revision.id };
  });
}

export const swapSongbookEntryToFork = onCall((request) =>
  swapSongbookEntryHandler(request.auth?.uid, request.data),
);
