import { describe, expect, it, vi } from "vitest";
import type { MigrationContext } from "./migration";
import { migrations } from "../migrations/index";
import { runMigrations } from "./migrationRunner";
import { parseMigrationOptions } from "./migrationOptions";

vi.mock("./env", () => ({ CADERNIN_UID: "test-owner" }));

describe("registered migration kind audit", () => {
  it("classifies rollout-specific invitation deletion and curated catalog migrations as datasets", () => {
    expect(migrations.filter((migration) => migration.kind === "dataset").map((migration) => migration.id)).toEqual([
      "202610081202", "202610311300", "202610311301",
    ]);
  });
  it("blocks a deploy from the legacy production schema before any existing migration reads or writes", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const collection = vi.fn(() => { throw new Error("Migration touched Firestore before preflight"); });
    const ctx = { db: { collection }, bucket: {}, dryRun: false } as unknown as MigrationContext;
    try {
      await expect(runMigrations(ctx, migrations, { version: "202604271800", cleanedVersion: null },
        parseMigrationOptions(["--execute", "--forward-only"]),
      )).rejects.toThrow("202610081202, 202610311300, 202610311301");
      expect(collection).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
