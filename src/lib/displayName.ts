import type { User } from "firebase/auth";

// Keep in sync with functions/src and the member migration, which apply the
// same fallback to accounts that never set a name.
export const UNNAMED_USER = "Usuário sem nome";

export function displayNameOf(user: Pick<User, "displayName">): string {
  return user.displayName?.trim() || UNNAMED_USER;
}
