import { getAuth } from "firebase-admin/auth";
import { UNNAMED_USER } from "../../src/lib/displayName";

/** Firebase Auth caps `getUsers` at 100 identifiers per call. */
const GET_USERS_LIMIT = 100;

/**
 * Display names from Firebase Auth, the only place they live (nothing writes
 * `users/{uid}`). Unknown or unnamed accounts get the app's fallback.
 */
export async function authDisplayNames(
  uids: Iterable<string>,
): Promise<Map<string, string>> {
  const unique = [...new Set(uids)];
  const names = new Map(unique.map((uid) => [uid, UNNAMED_USER]));
  for (let i = 0; i < unique.length; i += GET_USERS_LIMIT) {
    const { users } = await getAuth().getUsers(
      unique.slice(i, i + GET_USERS_LIMIT).map((uid) => ({ uid })),
    );
    for (const user of users) {
      const name = user.displayName?.trim();
      if (name) {
        names.set(user.uid, name);
      }
    }
  }
  return names;
}
