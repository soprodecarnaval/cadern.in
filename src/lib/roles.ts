import type {
  InvitableRole,
  ProjectDoc,
  UserProjectRole,
} from "../../types/docs";

/** A project role, or `undefined` for non-members. */
export type Role = UserProjectRole | undefined;

export function isOwner(role: Role): boolean {
  return role === "owner";
}

export function isAdmin(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function isEditor(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

export function isReviewer(role: Role): boolean {
  return role !== undefined;
}

export const canEditProjectTitle = isEditor;
export const canInvite = isAdmin;
export const canEditScoreMetadata = isAdmin;
export const canDeleteProject = isOwner;
export const canDeleteScore = isOwner;
export const canEditSongbook = isAdmin;
export const canRepinSongbook = isEditor;
export const canPublishSongbook = isOwner;
export const canDeleteSongbook = isOwner;

export const INVITABLE_ROLES: InvitableRole[] = ["reviewer", "editor"];
// `owner` is never granted: a project has exactly one, and transferring it is
// deferred to the admin panel (collab-flow §8).
const OWNER_GRANTABLE_ROLES: UserProjectRole[] = ["reviewer", "editor", "admin"];

/** Roles `actor` may hand out, mirroring the `members` rule in firestore.rules. */
export function grantableRoles(actor: Role): UserProjectRole[] {
  if (isOwner(actor)) {
    return OWNER_GRANTABLE_ROLES;
  }
  if (isAdmin(actor)) {
    return INVITABLE_ROLES;
  }
  return [];
}

/**
 * Whether `actor` may change a member from `current` to `next`. Admins only
 * move people between editor and reviewer; owners may change anyone but
 * themselves, and never to or from `owner`, so a project keeps exactly one.
 */
export function canGrantRole(
  actor: Role,
  current: UserProjectRole,
  next: UserProjectRole,
  isSelf: boolean,
): boolean {
  if (isOwner(actor)) {
    return !isSelf && current !== "owner" && next !== "owner";
  }
  if (isAdmin(actor)) {
    return (
      INVITABLE_ROLES.includes(current as InvitableRole) &&
      INVITABLE_ROLES.includes(next as InvitableRole)
    );
  }
  return false;
}

export function canRemoveMember(actor: Role, isSelf: boolean): boolean {
  return isOwner(actor) && !isSelf;
}

/** Reads the legacy `members` map; only flag-off code may call this. */
export function legacyIsOwner(
  project: Pick<ProjectDoc, "members">,
  uid: string,
): boolean {
  return project.members?.[uid] === "owner";
}
