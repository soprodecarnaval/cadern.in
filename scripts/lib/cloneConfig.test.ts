import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCloneConfig } from "./cloneConfig";

let root: string;
function env(name: string, project: string, extra = "") {
  writeFileSync(join(root, `.env.${name}`), [
    `VITE_FIREBASE_PROJECT_ID=${project}`,
    `SCRIPTS_FIREBASE_STORAGE_BUCKET=${project}.firebasestorage.app`,
    `VITE_CADERNIN_UID=${name}-uid`,
    `GOOGLE_APPLICATION_CREDENTIALS=./secrets/${name}.json`,
    extra,
  ].join("\n"));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "clone-config-"));
  env("production", "prod-project");
  env("staging", "stage-project");
  env("local", "local-project");
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); vi.unstubAllEnvs(); });

describe("clone environment selection", () => {
  it("loads separate files without inheriting shell settings", () => {
    vi.stubEnv("SCRIPTS_FIREBASE_PROJECT_ID", "unrelated-shell-project");
    const config = loadCloneConfig(["--from=production", "--to=staging"], root);
    expect(config.execute).toBe(false);
    expect(config.source).toMatchObject({ projectId: "prod-project", uid: "production-uid", databaseId: "(default)" });
    expect(config.target).toMatchObject({ projectId: "stage-project", uid: "staging-uid", credentialsPath: join(root, "secrets/staging.json") });
  });
  it("accepts local destinations, script settings and explicit execute", () => {
    env("local", "local-project", "SCRIPTS_FIREBASE_PROJECT_ID=local-project\nSCRIPTS_CADERNIN_UID=local-uid\nSCRIPTS_FIRESTORE_DATABASE_ID=rehearsal");
    expect(loadCloneConfig(["--to=local", "--execute", "--from=staging"], root)).toMatchObject({ execute: true, target: { databaseId: "rehearsal" } });
  });
  it.each([
    { args: [] },
    { args: ["production", "staging"] },
    { args: ["--from=production"] },
    { args: ["--to=staging"] },
    { args: ["--from=", "--to=staging"] },
    { args: ["--from=production", "--to="] },
    { args: ["--from=prod", "--to=staging"] },
    { args: ["--from=production", "--to=../staging"] },
    { args: ["--from", "production", "--to", "staging"] },
    { args: ["--from=production", "--to=staging", "--force"] },
    { args: ["--from=production", "--from=local", "--to=staging"] },
    { args: ["--from=production", "--to=staging", "--to=local"] },
    { args: ["--from=production", "--to=staging", "--execute", "--execute"] },
  ])("rejects invalid arguments $args", ({ args }) => {
    expect(() => loadCloneConfig(args, root)).toThrow("Usage:");
  });
  it("rejects production destination before reading files", () => {
    expect(() => loadCloneConfig(["--from=staging", "--to=production", "--execute"], "/nonexistent")).toThrow("Production cannot");
  });
  it.each(["local", "staging"])("rejects %s when it resolves to the configured production project", (name) => {
    env(name, "prod-project");
    expect(() => loadCloneConfig(["--from=production", `--to=${name}`], root)).toThrow("resolves to production");
  });
  it("protects the real production project even with a misconfigured production file", () => {
    env("staging", "cadernin-6c0d1");
    expect(() => loadCloneConfig(["--from=local", "--to=staging"], root)).toThrow("resolves to production");
  });
  it("rejects aliases of the same database or bucket", () => {
    env("local", "stage-project");
    expect(() => loadCloneConfig(["--from=local", "--to=staging"], root)).toThrow("same Firestore database");
    env("local", "stage-project", "SCRIPTS_FIRESTORE_DATABASE_ID=other");
    expect(() => loadCloneConfig(["--from=local", "--to=staging"], root)).toThrow("same Storage bucket");
  });
  it("rejects ambiguous settings and mismatched buckets", () => {
    env("staging", "stage-project", "SCRIPTS_FIREBASE_PROJECT_ID=prod-project");
    expect(() => loadCloneConfig(["--from=production", "--to=staging"], root)).toThrow("disagree");
    env("staging", "stage-project", "VITE_FIREBASE_STORAGE_BUCKET=prod-project.firebasestorage.app");
    expect(() => loadCloneConfig(["--from=production", "--to=staging"], root)).toThrow("disagree");
    env("staging", "stage-project", "SCRIPTS_FIREBASE_STORAGE_BUCKET=prod-project.firebasestorage.app");
    expect(() => loadCloneConfig(["--from=production", "--to=staging"], root)).toThrow("bucket must belong");
  });
  it("rejects missing credentials and emulator configuration", () => {
    env("staging", "stage-project", "GOOGLE_APPLICATION_CREDENTIALS=");
    expect(() => loadCloneConfig(["--from=production", "--to=staging"], root)).toThrow("missing GOOGLE_APPLICATION_CREDENTIALS");
    env("staging", "stage-project", "FIRESTORE_EMULATOR_HOST=localhost:8080");
    expect(() => loadCloneConfig(["--from=production", "--to=staging"], root)).toThrow("unset emulator variables");
  });
});
