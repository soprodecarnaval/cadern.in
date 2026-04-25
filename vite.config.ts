import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

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
    plugins: [react()],
    build: {
      target: "esnext",
    },
    define: Object.fromEntries(
      Object.entries(resolvedOptionals).map(([k, v]) => [
        `import.meta.env.${k}`,
        JSON.stringify(v),
      ]),
    ),
  };
});
