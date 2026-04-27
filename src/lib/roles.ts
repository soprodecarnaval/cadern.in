import type { ProjectDoc, UserProjectRole } from "../../types/docs";

export function memberRole(
  project: Pick<ProjectDoc, "members">,
  uid: string,
): UserProjectRole | undefined {
  return project.members[uid] as UserProjectRole | undefined;
}

export function isOwner(project: Pick<ProjectDoc, "members">, uid: string): boolean {
  return memberRole(project, uid) === "owner";
}

export function isAdmin(project: Pick<ProjectDoc, "members">, uid: string): boolean {
  const role = memberRole(project, uid);
  return role === "owner" || role === "admin";
}

export function isEditor(project: Pick<ProjectDoc, "members">, uid: string): boolean {
  const role = memberRole(project, uid);
  return role === "owner" || role === "admin" || role === "editor";
}

export function isReviewer(project: Pick<ProjectDoc, "members">, uid: string): boolean {
  return memberRole(project, uid) !== undefined;
}
