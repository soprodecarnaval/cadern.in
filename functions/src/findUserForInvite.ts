import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

// Keep in sync with src/lib/displayName.ts.
const UNNAMED_USER = "Usuário sem nome";

export interface FindUserForInviteRequest {
  projectId: string;
  email: string;
}

/** Mirrored by `FindUserForInviteResult` in src/lib/db.ts. */
export type FindUserForInviteResult =
  | { status: "found"; uid: string; displayName: string }
  | { status: "not-found" };

/**
 * Resolve an existing account for an authorized project administrator.
 * @param {string | undefined} callerUid Caller identity.
 * @param {unknown} data Project and email payload.
 * @return {Promise<FindUserForInviteResult>} Lookup result without email.
 */
export async function findUserForInviteHandler(
  callerUid: string | undefined,
  data: unknown,
): Promise<FindUserForInviteResult> {
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in to invite members.");
  }
  const { projectId, email } = (data ?? {}) as
    Partial<FindUserForInviteRequest>;
  if (typeof projectId !== "string" || !projectId ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new HttpsError("invalid-argument", "projectId and valid email.");
  }

  const db = getFirestore();
  const project = db.collection("projects").doc(projectId);
  const [projectSnap, memberSnap] = await Promise.all([
    project.get(),
    project.collection("members").doc(callerUid).get(),
  ]);
  const role = memberSnap.get("role");
  if (!projectSnap.exists || projectSnap.get("deletedAt") ||
      !(role === "owner" || role === "admin")) {
    throw new HttpsError("permission-denied", "Only admins can invite.");
  }

  try {
    const user = await getAuth().getUserByEmail(email.trim());
    return {
      status: "found",
      uid: user.uid,
      displayName: user.displayName?.trim() || UNNAMED_USER,
    };
  } catch (error) {
    if (typeof error === "object" && error !== null &&
        "code" in error && error.code === "auth/user-not-found") {
      return { status: "not-found" };
    }
    throw error;
  }
}

export const findUserForInvite = onCall((request) =>
  findUserForInviteHandler(request.auth?.uid, request.data),
);
