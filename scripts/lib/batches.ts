import type { MigrationContext } from "./migration";

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 400;

export type Write = (batch: FirebaseFirestore.WriteBatch) => void;

export async function commitInChunks(
  db: MigrationContext["db"],
  writes: Write[],
): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const write of chunk) {
      write(batch);
    }
    await batch.commit();
    console.log(`  committed ${i + chunk.length}/${writes.length}`);
  }
}
