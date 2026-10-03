import { loadEnv } from "vite";

/**
 * Shared env handling for the website and the export app.
 *
 * Both talk to the same Firebase project, so a key present in one build and
 * missing in the other is a silent mismatch — the kind that surfaces as an
 * unexplained permission error rather than a build failure.
 */
const REQUIRED_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

const OPTIONAL_DEFAULTS: Record<string, string> = {
  VITE_FIRESTORE_DATABASE_ID: "(default)",
};

const FEATURE_FLAG_KEYS = ["VITE_FEATURE_FLAG_AUTH_ENABLED"] as const;

export interface AppEnv {
  env: Record<string, string>;
  /** `define` entries supplying defaults Vite would otherwise leave undefined. */
  define: Record<string, string>;
}

export function loadAppEnv(mode: string, envDir: string): AppEnv {
  const env = loadEnv(mode, envDir, "VITE_");

  const missing = REQUIRED_KEYS.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required env vars:\n${missing.map((k) => `  - ${k}`).join("\n")}`,
    );
  }

  const resolvedOptionals = Object.fromEntries(
    Object.entries(OPTIONAL_DEFAULTS).map(([k, fallback]) => {
      const value = env[k] ?? fallback;
      if (!env[k]) {
        console.warn(`${k} not set, using fallback: ${fallback}`);
      }
      return [k, value];
    }),
  );

  const flags = FEATURE_FLAG_KEYS.map(
    (k) => `  - ${k}=${env[k] ?? "false"}`,
  ).join("\n");
  console.info(`Feature flags:\n${flags}`);

  return {
    env,
    define: Object.fromEntries(
      Object.entries(resolvedOptionals).map(([k, v]) => [
        `import.meta.env.${k}`,
        JSON.stringify(v),
      ]),
    ),
  };
}
