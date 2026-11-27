import { createHash } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const segment = (value: unknown): string => {
  if (typeof value !== "string" || !value || value.length > 500 ||
      value.includes("/") || value === "." || value === "..") {
    throw new HttpsError("invalid-argument", "Identificador inválido.");
  }
  return value;
};

export async function changeScoreReviewRequestHandler(uid: string | undefined, data: unknown): Promise<void> {
  if (!uid) { throw new HttpsError("unauthenticated", "Entre na sua conta."); }
  const input = (data ?? {}) as Record<string, unknown>;
  const projectId = segment(input.projectId);
  const db = getFirestore();
  const project = db.collection("projects").doc(projectId);
  const requests = project.collection("scoreReviewRequests");
  const member = (uid: string) => project.collection("members").doc(uid);
  const lock = (scoreId: string, revisionId: string, assigneeId: string) => {
    const key = createHash("sha256").update(JSON.stringify([scoreId, revisionId, assigneeId])).digest("hex");
    return project.collection("scoreReviewLocks").doc(key);
  };
  return db.runTransaction(async (tx) => {
    const [projectSnap, actor] = await tx.getAll(project, member(uid));
    if (!projectSnap.exists || projectSnap.get("deletedAt") || !actor.exists) {
      throw new HttpsError("permission-denied", "Você não faz parte deste projeto.");
    }
    if (input.action === "request") {
      const scoreId = segment(input.scoreId);
      const revisionId = segment(input.revisionId);
      const assigneeId = segment(input.assigneeId);
      const score = db.collection("scores").doc(scoreId);
      const pending = lock(scoreId, revisionId, assigneeId);
      const [scoreSnap, revision, assignee, existing] = await tx.getAll(
        score, score.collection("scoreRevisions").doc(revisionId), member(assigneeId), pending,
      );
      if (!scoreSnap.exists || scoreSnap.get("deletedAt") ||
          scoreSnap.get("projectId") !== projectId || !revision.exists ||
          !assignee.exists || assigneeId === uid) {
        throw new HttpsError("failed-precondition", "Partitura, versão ou pessoa inválida.");
      }
      if (existing.exists) {
        throw new HttpsError("already-exists", "Já existe uma revisão pendente para esta pessoa e versão.");
      }
      const request = requests.doc();
      tx.create(request, {
        scoreId, revisionId, assigneeId, requesterId: uid,
        status: "pending", createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(pending, { requestId: request.id });
      return;
    }

    const status = input.status;
    if (input.action !== "close" || (status !== "approved" &&
        status !== "changes-requested" && status !== "commented" && status !== "dismissed")) {
      throw new HttpsError("invalid-argument", "Resultado de revisão inválido.");
    }
    const request = requests.doc(segment(input.requestId));
    const current = await tx.get(request);
    if (!current.exists || current.get("status") !== "pending") {
      throw new HttpsError("failed-precondition", "Esta solicitação não está pendente.");
    }
    const assigneeId = segment(current.get("assigneeId"));
    const admin = actor.get("role") === "admin" || actor.get("role") === "owner";
    if (assigneeId !== uid && !(status === "dismissed" && admin)) {
      throw new HttpsError("permission-denied", "Você não pode encerrar esta solicitação.");
    }
    tx.update(request, { status, closedBy: uid, closedAt: FieldValue.serverTimestamp() });
    tx.delete(lock(segment(current.get("scoreId")), segment(current.get("revisionId")), assigneeId));
  });
}

export const changeScoreReviewRequest = onCall((request) =>
  changeScoreReviewRequestHandler(request.auth?.uid, request.data),
);
