import { describe, expect, it } from "vitest";
import { migrationPlan } from "./migrationPlan";

describe("migrationPlan", () => {
  const ids = ["old", "middle", "new"];
  it("runs pending migrations in registry order", () => {
    expect(migrationPlan(ids, "old", null, true)).toEqual({ direction: "up", ids: ["middle", "new"] });
    expect(migrationPlan(ids, "new", null, true).ids).toEqual([]);
    expect(migrationPlan(ids, null, "middle").ids).toEqual(["old", "middle"]);
  });
  it("rejects unknown schemas instead of replaying all migrations", () => {
    expect(() => migrationPlan(ids, "future", null)).toThrow("Unknown database schema");
    expect(() => migrationPlan(ids, "old", "missing")).toThrow("Migration not found");
  });
  it("permits explicit local rollback, forbids deploy rollback", () => {
    expect(migrationPlan(ids, "new", "old")).toEqual({ direction: "down", ids: ["new", "middle"] });
    expect(() => migrationPlan(ids, "new", "old", true)).toThrow("cannot roll back");
  });
});
