import type { User } from "firebase/auth";

// Keep in sync with functions/src and the member migration, which apply the
// same fallback to accounts that never set a name.
export const UNNAMED_USER = "Usuário sem nome";

export function displayNameOf(user: Pick<User, "displayName">): string {
  return user.displayName?.trim() || UNNAMED_USER;
}

/** Up to two initials, from the display name or else the email. */
export function initialsOf(user: Pick<User, "displayName" | "email">): string {
  const words = (user.displayName?.trim() || user.email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
