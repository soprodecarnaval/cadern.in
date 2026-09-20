import { z } from "zod";
import type { Migration, MigrationContext } from "../lib/migration";
import { partNameFromStem, stemFromPartName } from "../lib/partNames";

/**
 * Pre-v2 uploads stored a part's *filename stem* in `parts[].name`, so it
 * carried the song title, the instrument and a disambiguator all mashed
 * together ("cadern.in test-trompete-a"). From metajson v2 onward the field
 * holds the name the arranger authored in MuseScore ("Trompete 1").
 *
 * This backfills the old shape into the new one so the field means one thing
 * everywhere, and the renderer no longer has to guess which it is holding.
 *
 * The authored name is *not* recoverable — it was never stored — so the result
 * is synthesised from the stem. It renders identically: the label is only shown
 * when a score has several parts for one instrument, and is uppercased.
 *
 * Safe to run: files are addressed by `StorageFile.path`/`url`, never by
 * `name`, so this is display-only.
 */

const zPart = z.object({ name: z.string() }).passthrough();

const zRevisionParts = z.object({ parts: z.array(zPart) }).passthrough();

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 400;

async function commitInChunks(
  db: MigrationContext["db"],
  updates: { ref: FirebaseFirestore.DocumentReference; parts: unknown[] }[],
): Promise<void> {
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const chunk = updates.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const { ref, parts } of chunk) {
      batch.update(ref, { parts });
    }
    await batch.commit();
    console.log(`  committed ${i + chunk.length}/${updates.length}`);
  }
}

const migration: Migration = {
  id: "202609201500",
  description: "revisions: parts[].name from filename stem to part name",

  async up(ctx: MigrationContext) {
    const { db, dryRun } = ctx;

    const scores = await db.collection("scores").get();
    const titleById = new Map(
      scores.docs.map((d) => [d.id, (d.data().title as string | undefined) ?? ""]),
    );
    console.log(`Found ${scores.size} scores`);

    // One collection-group query rather than a subcollection fetch per score:
    // at ~1k scores the latter is ~1k sequential round-trips.
    const revs = await db.collectionGroup("revisions").get();
    console.log(`Found ${revs.size} revisions\n`);

    const updates: { ref: FirebaseFirestore.DocumentReference; parts: unknown[] }[] = [];
    let skipped = 0;

    for (const revSnap of revs.docs) {
      const scoreId = revSnap.ref.parent.parent?.id;
      const title = scoreId ? titleById.get(scoreId) : undefined;
      if (!title) {
        skipped++;
        continue;
      }

      const parsed = zRevisionParts.safeParse(revSnap.data());
      if (!parsed.success) {
        skipped++;
        continue;
      }

      const parts = parsed.data.parts.map((part) => ({
        ...part,
        name: partNameFromStem(part.name, title),
      }));
      if (!parts.some((part, i) => part.name !== parsed.data.parts[i].name)) {
        continue;
      }

      if (dryRun) {
        const preview = parts
          .map((p, i) => `${parsed.data.parts[i].name} → ${p.name}`)
          .join(", ");
        console.log(`  [dry] ${scoreId}/${revSnap.id}: ${preview}`);
      }
      updates.push({ ref: revSnap.ref, parts });
    }

    console.log(
      `\n${updates.length} of ${revs.size} revisions to rename` +
        (skipped > 0 ? `, ${skipped} skipped (no title or unexpected shape)` : ""),
    );
    if (dryRun) {
      return;
    }

    await commitInChunks(db, updates);
  },

  async down(ctx: MigrationContext) {
    const { db, dryRun } = ctx;

    const scores = await db.collection("scores").get();
    const titleById = new Map(
      scores.docs.map((d) => [d.id, (d.data().title as string | undefined) ?? ""]),
    );
    const revs = await db.collectionGroup("revisions").get();

    const updates: { ref: FirebaseFirestore.DocumentReference; parts: unknown[] }[] = [];
    for (const revSnap of revs.docs) {
      const title = titleById.get(revSnap.ref.parent.parent?.id ?? "");
      if (!title) {
        continue;
      }
      const parsed = zRevisionParts.safeParse(revSnap.data());
      if (!parsed.success) {
        continue;
      }
      const parts = parsed.data.parts.map((part) => ({
        ...part,
        name: stemFromPartName(part.name, title),
      }));
      if (!parts.some((part, i) => part.name !== parsed.data.parts[i].name)) {
        continue;
      }
      updates.push({ ref: revSnap.ref, parts });
    }

    console.log(`${updates.length} revisions to restore`);
    if (dryRun) {
      return;
    }
    await commitInChunks(db, updates);
  },
};

export default migration;
