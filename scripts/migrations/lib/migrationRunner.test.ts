import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Migration, MigrationContext, SchemaDoc } from "./migration";
import { parseMigrationOptions } from "./migrationOptions";
import { runMigrations } from "./migrationRunner";

function fixture(dryRun = false) {
  const events: string[] = [];
  const save = vi.fn(async (data: { version?: string; cleanedVersion?: string }) => {
    events.push(`checkpoint:${data.version ?? data.cleanedVersion}`);
  });
  const collection = vi.fn(() => ({ doc: () => ({ set: save }) }));
  const ctx = { db: { collection }, bucket: {}, dryRun } as unknown as MigrationContext;
  const migration = (id: string, kind?: Migration["kind"]) => ({
    id, kind, description: id,
    up: vi.fn(async () => { events.push(`up:${id}`); }),
    down: vi.fn(async () => { events.push(`down:${id}`); }),
    cleanup: vi.fn(async () => { events.push(`cleanup:${id}`); }),
  });
  const registry = [migration("one"), migration("two", "dataset"), migration("three", "schema")];
  const schema: SchemaDoc = { version: null, cleanedVersion: null };
  const execute = (...args: string[]) => runMigrations(ctx, registry, schema,
    parseMigrationOptions([...args, ...(dryRun ? [] : ["--execute"])]));
  return { ctx, registry, schema, save, collection, events, execute };
}

beforeEach(() => { vi.spyOn(console, "log").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe("migration execution policy", () => {
  it("blocks the entire pending path before any hook or checkpoint", async () => {
    const f = fixture();
    await expect(f.execute("--forward-only")).rejects.toThrow("Dataset migrations require --include-dataset");
    expect(f.events).toEqual([]);
    expect(f.collection).not.toHaveBeenCalled();
    expect(f.registry.every((migration) => migration.up.mock.calls.length === 0)).toBe(true);
  });
  it("applies schema changes up to a target before the dataset boundary", async () => {
    const f = fixture();
    await f.execute("--to=one");
    expect(f.events).toEqual(["up:one", "checkpoint:one"]);
  });
  it("runs a bounded dataset opt-in in order without skipping or running beyond it", async () => {
    const f = fixture();
    await f.execute("--include-dataset", "--to=two");
    expect(f.events).toEqual(["up:one", "checkpoint:one", "up:two", "checkpoint:two"]);
    expect(f.registry[2].up).not.toHaveBeenCalled();
  });
  it("allows deploys past already-applied datasets, then becomes a no-op", async () => {
    const f = fixture();
    f.schema.version = "two";
    await f.execute("--forward-only");
    expect(f.events).toEqual(["up:three", "checkpoint:three"]);
    f.schema.version = "three";
    f.events.length = 0;
    await f.execute("--forward-only");
    expect(f.events).toEqual([]);
  });
  it("previews both kinds without opt-in and never writes checkpoints", async () => {
    const f = fixture(true);
    await f.execute();
    expect(f.events).toEqual(["up:one", "up:two", "up:three"]);
    expect(f.registry[1].up).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    expect(f.save).not.toHaveBeenCalled();
    const output = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(output).toContain("[schema] one");
    expect(output).toContain("[dataset] two");
  });
  it("does not advance the checkpoint for a failing migration", async () => {
    const f = fixture();
    f.registry[1].up.mockRejectedValueOnce(new Error("dataset failed"));
    await expect(f.execute("--include-dataset", "--to=three")).rejects.toThrow("dataset failed");
    expect(f.events).toEqual(["up:one", "checkpoint:one"]);
    expect(f.registry[2].up).not.toHaveBeenCalled();
  });
  it("preflights dataset rollback before rolling back a preceding schema step", async () => {
    const f = fixture();
    f.schema.version = "three";
    await expect(f.execute("--to=one")).rejects.toThrow("Dataset migrations require");
    expect(f.events).toEqual([]);
    await f.execute("--include-dataset", "--to=one");
    expect(f.events).toEqual(["down:three", "checkpoint:two", "down:two", "checkpoint:one"]);
  });
  it("continues to prohibit deploy rollback even with dataset opt-in", async () => {
    const f = fixture();
    f.schema.version = "three";
    await expect(f.execute("--include-dataset", "--to=one", "--forward-only")).rejects.toThrow("cannot roll back");
    expect(f.events).toEqual([]);
  });
  it("preflights cleanup kinds and honors the selected cleanup boundary", async () => {
    const f = fixture();
    f.schema.version = "three";
    const options = parseMigrationOptions(["cleanup", "--to=two", "--execute"]);
    await expect(runMigrations(f.ctx, f.registry, f.schema, options)).rejects.toThrow("Dataset migrations require");
    expect(f.events).toEqual([]);
    await runMigrations(f.ctx, f.registry, f.schema, { ...options, includeDataset: true });
    expect(f.events).toEqual(["cleanup:one", "checkpoint:one", "cleanup:two", "checkpoint:two"]);
    expect(f.save.mock.calls.every(([data]) => data.version === undefined && data.cleanedVersion !== undefined)).toBe(true);
  });
  it("does not repeat already-cleaned hooks or clean unapplied targets", async () => {
    const f = fixture();
    f.schema.version = "three";
    f.schema.cleanedVersion = "two";
    await f.execute("cleanup", "--to=two");
    expect(f.events).toEqual([]);
    f.schema.version = "one";
    await expect(f.execute("cleanup", "--to=three", "--include-dataset")).rejects.toThrow("has not been applied");
    expect(f.events).toEqual([]);
  });
  it("rejects unknown checkpoints before invoking hooks", async () => {
    const f = fixture();
    f.schema.version = "unknown";
    await expect(f.execute()).rejects.toThrow("Unknown database schema");
    f.schema.version = "three";
    f.schema.cleanedVersion = "unknown";
    await expect(f.execute("cleanup")).rejects.toThrow("Unknown database schema");
    expect(f.events).toEqual([]);
  });
  it("requires a target even when options bypass the CLI parser", async () => {
    const f = fixture();
    await expect(runMigrations(f.ctx, f.registry, f.schema, {
      command: "migrate", targetId: null, execute: true, forwardOnly: false, includeDataset: true,
    })).rejects.toThrow("requires an explicit --to");
    expect(f.events).toEqual([]);
  });
});
