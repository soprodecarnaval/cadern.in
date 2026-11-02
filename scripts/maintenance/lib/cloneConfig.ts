import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ENVIRONMENTS = ["local", "staging", "production"] as const;
type Environment = typeof ENVIRONMENTS[number];
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const USAGE = "Usage: cloneData.ts --from=<local|staging|production> --to=<local|staging> [--execute]";

export interface CloneEnvironment {
  name: Environment;
  projectId: string;
  bucket: string;
  databaseId: string;
  uid: string;
  credentialsPath: string;
}

function setting(env: Record<string, string>, key: string, fallback: string, file: string): string {
  const scriptValue = env[key]?.trim();
  const webValue = env[fallback]?.trim();
  if (scriptValue && webValue && scriptValue !== webValue) {
    throw new Error(`${file}: ${key} and ${fallback} disagree`);
  }
  const value = scriptValue || webValue;
  if (!value) throw new Error(`${file}: missing ${key} or ${fallback}`);
  return value;
}

function readEnvironment(name: Environment, root: string): CloneEnvironment {
  const file = `.env.${name}`;
  const env = parseEnv(readFileSync(resolve(root, file), "utf8"));
  if (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_STORAGE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(`${file}: unset emulator variables before cloning cloud data`);
  }
  const projectId = setting(env, "SCRIPTS_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID", file);
  const bucket = setting(env, "SCRIPTS_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET", file);
  if (!bucket.startsWith(`${projectId}.`)) throw new Error(`${file}: bucket must belong to its project`);
  const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath) throw new Error(`${file}: missing GOOGLE_APPLICATION_CREDENTIALS`);
  return {
    name, projectId, bucket,
    databaseId: env.SCRIPTS_FIRESTORE_DATABASE_ID?.trim() || env.VITE_FIRESTORE_DATABASE_ID?.trim() || "(default)",
    uid: setting(env, "SCRIPTS_CADERNIN_UID", "VITE_CADERNIN_UID", file),
    credentialsPath: resolve(root, credentialsPath),
  };
}

export function loadCloneConfig(args: string[], root = REPO_ROOT) {
  const options = new Map<string, string>();
  for (const arg of args) {
    const match = /^(--from|--to)=(.*)$/.exec(arg);
    const key = match?.[1] ?? arg;
    if ((!match && arg !== "--execute") || options.has(key)) throw new Error(USAGE);
    options.set(key, match?.[2] ?? "true");
  }
  const sourceName = options.get("--from");
  const targetName = options.get("--to");
  if (!ENVIRONMENTS.includes(sourceName as Environment) || !ENVIRONMENTS.includes(targetName as Environment)) {
    throw new Error(USAGE);
  }
  if (targetName === "production") throw new Error("Production cannot be a clone destination");
  if (sourceName === targetName) throw new Error("Source and destination must differ");

  const source = readEnvironment(sourceName as Environment, root);
  const target = readEnvironment(targetName as Environment, root);
  // Check resolved resources too: local/staging files can accidentally point at production.
  const production = parseEnv(readFileSync(resolve(root, ".env.production"), "utf8"));
  const productionProjects = new Set([
    "cadernin-6c0d1", production.SCRIPTS_FIREBASE_PROJECT_ID, production.VITE_FIREBASE_PROJECT_ID,
  ].filter(Boolean));
  const productionBuckets = new Set([
    "cadernin-6c0d1.firebasestorage.app", "cadernin-6c0d1.appspot.com",
    production.SCRIPTS_FIREBASE_STORAGE_BUCKET, production.VITE_FIREBASE_STORAGE_BUCKET,
  ].filter(Boolean));
  if (productionProjects.has(target.projectId) || productionBuckets.has(target.bucket)) {
    throw new Error("Destination resolves to production; cloning refused");
  }
  if (source.projectId === target.projectId && source.databaseId === target.databaseId) {
    throw new Error("Source and destination resolve to the same Firestore database");
  }
  if (source.bucket === target.bucket) throw new Error("Source and destination resolve to the same Storage bucket");
  return { source, target, execute: options.has("--execute") };
}
