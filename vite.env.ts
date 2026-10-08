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

const FEATURE_FLAG_KEYS = ["VITE_FEATURE_FLAG_COLLAB_FLOW"] as const;

// `npm run dev:emulators` (VITE_USE_EMULATORS=true): the app talks to the local
// emulators under a `demo-` project, which can never reach a real one, so no
// real config is needed — and any in .env files is overridden.
export const EMULATOR_PROJECT_ID = "demo-cadernin";
const EMULATOR_ENV: Record<(typeof REQUIRED_KEYS)[number], string> = {
  VITE_FIREBASE_API_KEY: "demo-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: `${EMULATOR_PROJECT_ID}.appspot.com`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: "0",
  VITE_FIREBASE_APP_ID: "demo-app-id",
};

export interface AppEnv {
  env: Record<string, string>;
  /** `define` entries supplying defaults Vite would otherwise leave undefined. */
  define: Record<string, string>;
}

export function loadAppEnv(mode: string, envDir: string): AppEnv {
  const loaded = loadEnv(mode, envDir, "VITE_");
  const useEmulators = loaded.VITE_USE_EMULATORS === "true";
  const env = useEmulators ? { ...loaded, ...EMULATOR_ENV } : loaded;
  if (useEmulators) {
    console.info(`Using the Firebase emulators (${EMULATOR_PROJECT_ID})`);
  }

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
      Object.entries({
        ...resolvedOptionals,
        ...(useEmulators ? EMULATOR_ENV : {}),
      }).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
    ),
  };
}
