import { readFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type CollectionReference, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { clonePath, cloneValue, type CloneMapping } from "./lib/cloneData";
import { loadCloneConfig, type CloneEnvironment } from "./lib/cloneConfig";

function app(config: CloneEnvironment) {
  const credentials = JSON.parse(readFileSync(config.credentialsPath, "utf8"));
  if (credentials.project_id !== config.projectId) throw new Error(`.env.${config.name}: credentials must belong to its project`);
  return initializeApp({
    credential: cert(credentials), projectId: config.projectId,
    storageBucket: config.bucket,
  }, config.name);
}

async function parallel<T>(items: T[], action: (item: T) => Promise<void>) {
  const queue = [...items];
  const results = await Promise.allSettled(Array.from({ length: 8 }, async () => {
    while (queue.length) await action(queue.shift()!);
  }));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

async function inventory(collections: CollectionReference[]): Promise<Map<string, DocumentData>> {
  const documents = new Map<string, DocumentData>();
  let pending = collections;
  while (pending.length) {
    const next: CollectionReference[] = [];
    await parallel(pending, async (collection) => {
      // listDocuments includes missing parents that still have subcollections.
      const refs = await collection.listDocuments();
      await parallel(refs, async (ref) => {
        const snapshot = await ref.get();
        if (snapshot.exists) documents.set(ref.path, snapshot.data()!);
        next.push(...await ref.listCollections());
      });
    });
    pending = next;
  }
  return documents;
}

async function main() {
  const config = loadCloneConfig(process.argv.slice(2));
  const { execute } = config;
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("Unset emulator variables before cloning cloud data");
  }
  const source = app(config.source);
  const target = app(config.target);
  const sourceDb = getFirestore(source, config.source.databaseId);
  const targetDb = getFirestore(target, config.target.databaseId);
  const sourceBucket = getStorage(source).bucket();
  const targetBucket = getStorage(target).bucket();
  const mapping: CloneMapping = {
    sourceBucket: sourceBucket.name, targetBucket: targetBucket.name,
    sourceUid: config.source.uid, targetUid: config.target.uid,
  };
  await Promise.all([
    getAuth(source).getUser(mapping.sourceUid), getAuth(target).getUser(mapping.targetUid),
  ]);
  console.log(`${execute ? "REPLACE" : "DRY RUN"}: ${config.source.name} (${config.source.projectId}) → ${config.target.name} (${config.target.projectId}); Auth unchanged`);
  const [sourceDocs, targetDocs, [sourceFiles], [targetFiles]] = await Promise.all([
    sourceDb.listCollections().then(inventory), targetDb.listCollections().then(inventory),
    sourceBucket.getFiles(), targetBucket.getFiles(),
  ]);
  const mappedDocs = new Map<string, DocumentData>();
  for (const [path, value] of sourceDocs) {
    if (path === "_meta/stagingClone") continue;
    const mappedPath = clonePath(path, mapping);
    if (mappedDocs.has(mappedPath)) throw new Error(`UID mapping collides at ${mappedPath}`);
    mappedDocs.set(mappedPath, cloneValue(value, mapping, targetDb) as DocumentData);
  }
  console.log(`Copy ${mappedDocs.size} documents, ${sourceFiles.length} objects; replace ${targetDocs.size} staging documents, ${targetFiles.length} objects`);
  if (!execute) return;

  await targetDb.doc("_meta/stagingClone").set({ status: "running", startedAt: new Date() });

  // Copy objects before changing Firestore so copied download URLs work immediately.
  await parallel(sourceFiles, async (file) => {
    const [metadata] = await file.getMetadata();
    await pipeline(file.createReadStream({ decompress: false }), targetBucket.file(file.name).createWriteStream({
      resumable: false,
      metadata: {
        contentType: metadata.contentType,
        cacheControl: metadata.cacheControl,
        contentDisposition: metadata.contentDisposition,
        contentEncoding: metadata.contentEncoding,
        metadata: metadata.metadata,
      },
    }));
  });
  // The schema marker is committed last; partial copies must not appear migrated.
  const schema = mappedDocs.get("_meta/schema");
  mappedDocs.delete("_meta/schema");
  const writer = targetDb.bulkWriter();
  const operations: Promise<unknown>[] = [];
  for (const path of targetDocs.keys()) {
    if (path === "_meta/stagingClone") continue;
    if (!mappedDocs.has(path)) operations.push(writer.delete(targetDb.doc(path)));
  }
  for (const [path, value] of mappedDocs) operations.push(writer.set(targetDb.doc(path), value));
  const writes = Promise.allSettled(operations);
  await writer.close();
  const results = await writes;
  if (results.some((result) => result.status === "rejected")) throw new Error("Firestore copy incomplete; rerun clone before migrating");
  const sourceNames = new Set(sourceFiles.map((file) => file.name));
  await parallel(targetFiles.filter((file) => !sourceNames.has(file.name)), async (file) => { await file.delete(); });
  if (schema) await targetDb.doc("_meta/schema").set(schema);
  await targetDb.doc("_meta/stagingClone").set({ status: "complete", completedAt: new Date(), sourceProject: config.source.projectId });
  console.log(`Clone complete. Run ${config.target.name} migrations before reopening the destination.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
