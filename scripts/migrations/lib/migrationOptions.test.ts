import { describe, expect, it } from "vitest";
import { parseMigrationOptions } from "./migrationOptions";

describe("migration CLI options", () => {
  it("defaults to a dry run without dataset execution opt-in", () => {
    expect(parseMigrationOptions([])).toEqual({
      command: "migrate", execute: false, includeDataset: false, forwardOnly: false, targetId: null,
    });
  });
  it("accepts bounded dataset execution and both target syntaxes", () => {
    expect(parseMigrationOptions(["--include-dataset", "--to", "m7", "--execute"])).toMatchObject({
      execute: true, includeDataset: true, targetId: "m7",
    });
    expect(parseMigrationOptions(["--to=m7", "--forward-only"])).toMatchObject({
      targetId: "m7", forwardOnly: true,
    });
    expect(parseMigrationOptions(["cleanup", "--to=m7", "--include-dataset", "--execute"])).toMatchObject({
      command: "cleanup", targetId: "m7", includeDataset: true,
    });
  });
  it.each([
    { args: ["--include-dataset"] },
    { args: ["--execute", "--include-dataset"] },
    { args: ["cleanup", "--include-dataset"] },
  ])("requires an explicit dataset target: $args", ({ args }) => {
    expect(() => parseMigrationOptions(args)).toThrow("requires an explicit --to");
  });
  it.each([
    { args: ["--to"] }, { args: ["--to="] }, { args: ["--to", "--execute"] },
    { args: ["--to=a", "--to", "b"] }, { args: ["--execute", "--execute"] },
    { args: ["--include-dataset", "--include-dataset", "--to=a"] },
    { args: ["--include-datset", "--to=a", "--execute"] },
    { args: ["--execute=true"] }, { args: ["up"] },
    { args: ["cleanup", "--forward-only"] },
  ])("rejects malformed, duplicate and irrelevant flags: $args", ({ args }) => {
    expect(() => parseMigrationOptions(args)).toThrow();
  });
});
