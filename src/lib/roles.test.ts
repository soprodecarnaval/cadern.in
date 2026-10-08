import { describe, expect, it } from "vitest";
import {
  canDeleteProject,
  canDeleteScore,
  canGrantRole,
  canRemoveMember,
  grantableRoles,
  isAdmin,
  isEditor,
  isOwner,
  isReviewer,
  legacyIsOwner,
  type Role,
} from "./roles";

describe("role hierarchy", () => {
  it("is cumulative", () => {
    expect(
      [isOwner, isAdmin, isEditor, isReviewer].map((f) => f("owner")),
    ).toEqual([true, true, true, true]);
    expect(
      [isOwner, isAdmin, isEditor, isReviewer].map((f) => f("admin")),
    ).toEqual([false, true, true, true]);
    expect(
      [isOwner, isAdmin, isEditor, isReviewer].map((f) => f("editor")),
    ).toEqual([false, false, true, true]);
    expect(
      [isOwner, isAdmin, isEditor, isReviewer].map((f) => f("reviewer")),
    ).toEqual([false, false, false, true]);
    expect(
      [isOwner, isAdmin, isEditor, isReviewer].map((f) => f(undefined)),
    ).toEqual([false, false, false, false]);
  });
});

describe("grantableRoles", () => {
  it("gives owners every role but owner, and admins only editor/reviewer", () => {
    expect(grantableRoles("owner")).toEqual(["reviewer", "editor", "admin"]);
    expect(grantableRoles("admin")).toEqual(["reviewer", "editor"]);
    expect(grantableRoles("editor")).toEqual([]);
    expect(grantableRoles(undefined)).toEqual([]);
  });
});

describe("canGrantRole", () => {
  it("lets an owner change anyone but themselves, never to or from owner", () => {
    expect(canGrantRole("owner", "editor", "admin", false)).toBe(true);
    expect(canGrantRole("owner", "admin", "reviewer", false)).toBe(true);
    expect(canGrantRole("owner", "admin", "owner", false)).toBe(false);
    expect(canGrantRole("owner", "owner", "admin", true)).toBe(false);
  });

  it("limits admins to moving people between editor and reviewer", () => {
    expect(canGrantRole("admin", "reviewer", "editor", false)).toBe(true);
    expect(canGrantRole("admin", "editor", "admin", false)).toBe(false);
    expect(canGrantRole("admin", "admin", "editor", false)).toBe(false);
    expect(canGrantRole("admin", "owner", "editor", false)).toBe(false);
  });

  it("denies editors and below", () => {
    expect(canGrantRole("editor", "reviewer", "editor", false)).toBe(false);
    expect(canGrantRole(undefined, "reviewer", "editor", false)).toBe(false);
  });
});

describe("canRemoveMember", () => {
  it("is owner-only and never on oneself", () => {
    expect(canRemoveMember("owner", false)).toBe(true);
    expect(canRemoveMember("owner", true)).toBe(false);
    expect(canRemoveMember("admin", false)).toBe(false);
  });
});

describe("deletion", () => {
  it("is owner-only for projects and scores", () => {
    expect(
      ["owner", "admin", "editor"].map((r) => canDeleteProject(r as Role)),
    ).toEqual([true, false, false]);
    expect(canDeleteScore("owner")).toBe(true);
    expect(canDeleteScore("admin")).toBe(false);
  });
});

describe("legacyIsOwner", () => {
  it("reads the legacy map and tolerates its absence", () => {
    expect(legacyIsOwner({ members: { a: "owner" } }, "a")).toBe(true);
    expect(legacyIsOwner({ members: { a: "admin" } }, "a")).toBe(false);
    expect(legacyIsOwner({}, "a")).toBe(false);
  });
});
