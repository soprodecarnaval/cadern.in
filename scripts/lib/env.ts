const REQUIRED_KEYS = [
  "SCRIPTS_FIREBASE_STORAGE_BUCKET",
  "SCRIPTS_CADERNIN_UID",
] as const;

const OPTIONAL_DEFAULTS: Record<string, string> = {
  SCRIPTS_FIRESTORE_DATABASE_ID: "(default)",
};

const missing = REQUIRED_KEYS.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(
    `Missing required env vars:\n${missing.map((k) => `  - ${k}`).join("\n")}`,
  );
}

const resolvedOptionals = Object.fromEntries(
  Object.entries(OPTIONAL_DEFAULTS).map(([k, fallback]) => {
    const value = process.env[k] ?? fallback;
    if (!process.env[k]) console.warn(`${k} not set, using fallback: ${fallback}`);
    return [k, value];
  }),
);

export const FIREBASE_STORAGE_BUCKET = process.env.SCRIPTS_FIREBASE_STORAGE_BUCKET!;
export const CADERNIN_UID = process.env.SCRIPTS_CADERNIN_UID!;
export const FIRESTORE_DATABASE_ID = resolvedOptionals.SCRIPTS_FIRESTORE_DATABASE_ID;
