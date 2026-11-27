import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { getUserMemberProjects } from "./db";

export const reviewOutcomes = {
  approved: "Aprovado",
  "changes-requested": "Alterações solicitadas",
  commented: "Comentado",
  dismissed: "Dispensado",
} as const;

export type ReviewOutcome = keyof typeof reviewOutcomes;
export type ScoreReviewRequest = {
  id: string;
  projectId: string;
  scoreId: string;
  revisionId: string;
  assigneeId: string;
  requesterId: string;
  status: "pending" | ReviewOutcome;
};

type ReviewAction =
  | { action: "request"; projectId: string; scoreId: string; revisionId: string; assigneeId: string }
  | { action: "close"; projectId: string; requestId: string; status: ReviewOutcome };

export async function changeScoreReviewRequest(action: ReviewAction): Promise<void> {
  await httpsCallable<ReviewAction, void>(functions, "changeScoreReviewRequest")(action);
}

const requests = (projectId: string) => collection(db, "projects", projectId, "scoreReviewRequests");

export async function listScoreReviewRequests(
  projectId: string, scoreId: string, revisionId: string,
): Promise<ScoreReviewRequest[]> {
  const snap = await getDocs(query(requests(projectId), where("scoreId", "==", scoreId)));
  return snap.docs
    .map((doc) => ({ ...doc.data(), id: doc.id, projectId }) as ScoreReviewRequest)
    .filter((request) => request.revisionId === revisionId);
}

export async function listPendingScoreReviewRequests(uid: string): Promise<ScoreReviewRequest[]> {
  const projects = await getUserMemberProjects(uid);
  return (await Promise.all(projects.map(async ({ id: projectId }) => {
    const snap = await getDocs(query(requests(projectId), where("assigneeId", "==", uid)));
    return snap.docs
      .map((doc) => ({ ...doc.data(), id: doc.id, projectId }) as ScoreReviewRequest)
      .filter((request) => request.status === "pending");
  }))).flat();
}
