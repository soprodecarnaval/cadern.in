import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

// Keep in sync with src/lib/displayName.ts.
const UNNAMED_USER = "Usuário sem nome";

export interface FindUserForInviteRequest {
  projectId: string;
  displayName: string;
}

/** Mirrored by `FindUserForInviteResult` in src/lib/db.ts. */
export type FindUserForInviteResult =
  | { status: "found"; uid: string; displayName: string }
  | { status: "not-found" }
  | { status: "ambiguous" };

/**
 * Normalizes a display name for comparison: case- and accent-form-insensitive,
 * ignoring surrounding whitespace.
 * @param {string} name A display name as typed or stored.
 * @return {string} The comparison key.
 */
export function normalizeName(name: string): string {
  return name.normalize("NFC").trim().toLocaleLowerCase("pt-BR");
}

/**
 * Lists every Auth user whose display name matches `displayName`.
 * Display names are not indexed, so this pages through all users; fine at
 * cadern.in's scale, and the reason the lookup is server-side at all.
 * @param {string} displayName The name to match.
 * @return {Promise<UserRecord[]>} The matching users.
 */
async function usersNamed(displayName: string): Promise<UserRecord[]> {
  const wanted = normalizeName(displayName);
  const matches: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    matches.push(
      ...page.users.filter(
        (u) => u.displayName && normalizeName(u.displayName) === wanted,
      ),
    );
    pageToken = page.pageToken;
  } while (pageToken);
  return matches;
}

/**
 * Resolves a display name to a user, for an ADMIN+ of `projectId` who is
 * about to invite them. Returns only uid and display name — never email.
 * @param {string | undefined} callerUid The signed-in caller.
 * @param {unknown} data The request payload.
 * @return {Promise<FindUserForInviteResult>} The lookup outcome.
 */
export async function findUserForInviteHandler(
  callerUid: string | undefined,
  data: unknown,
): Promise<FindUserForInviteResult> {
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in to invite members.");
  }
  const { projectId, displayName } = (data ?? {}) as
    Partial<FindUserForInviteRequest>;
  if (typeof projectId !== "string" || !projectId ||
      typeof displayName !== "string" || !displayName.trim()) {
    throw new HttpsError("invalid-argument", "projectId and displayName.");
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

  const matches = await usersNamed(displayName);
  if (matches.length === 0) {
    return { status: "not-found" };
  }
  if (matches.length > 1) {
    return { status: "ambiguous" };
  }
  return {
    status: "found",
    uid: matches[0].uid,
    displayName: matches[0].displayName?.trim() || UNNAMED_USER,
  };
}

export const findUserForInvite = onCall((request) =>
  findUserForInviteHandler(request.auth?.uid, request.data),
);
