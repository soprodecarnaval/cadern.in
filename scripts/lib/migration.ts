import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";

export type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

export interface MigrationContext {
  db: Firestore;
  bucket: Bucket;
  dryRun: boolean;
}

export interface Migration {
  id: string;
  description: string;
  up(ctx: MigrationContext): Promise<void>;
  down(ctx: MigrationContext): Promise<void>;
  cleanup?(ctx: MigrationContext): Promise<void>;
}

const zSchemaDoc = z.object({
  version: z.string().nullable().default(null),
  cleanedVersion: z.string().nullable().default(null),
});

export type SchemaDoc = z.infer<typeof zSchemaDoc>;

function schemaRef(db: Firestore) {
  return db.collection("_meta").doc("schema");
}

export async function getSchema(db: Firestore): Promise<SchemaDoc> {
  const snap = await schemaRef(db).get();
  if (!snap.exists) {
    return { version: null, cleanedVersion: null };
  }
  return zSchemaDoc.parse(snap.data());
}

export async function setVersion(
  db: Firestore,
  version: string | null,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log(`[dry] _meta/schema.version → ${version ?? "(none)"}`);
    return;
  }
  await schemaRef(db).set(
    { version, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function setCleanedVersion(
  db: Firestore,
  cleanedVersion: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log(`[dry] _meta/schema.cleanedVersion → ${cleanedVersion}`);
    return;
  }
  await schemaRef(db).set(
    { cleanedVersion, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
