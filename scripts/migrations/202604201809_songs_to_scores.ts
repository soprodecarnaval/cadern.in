import { z } from "zod";
import type { Migration, MigrationContext } from "../lib/migration";

const zPartData = z.object({
  name: z.string(),
  instrument: z.string(),
  svg: z.array(z.string()),
  midi: z.string(),
});

const zRevisionDoc = z.object({
  revisionNumber: z.number().int().positive(),
  uploadedBy: z.string(),
  mscz: z.string(),
  metajson: z.string(),
  midi: z.string(),
  parts: z.array(zPartData),
  notes: z.string(),
  isLatest: z.boolean(),
  uploadedAt: z.unknown(),
});

const zScoreDoc = z.object({
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
  projectId: z.string(),
  uploadedBy: z.string(),
  latestRevisionId: z.string(),
  createdAt: z.unknown(),
  deletedAt: z.unknown().optional(),
});

type RevisionDoc = z.infer<typeof zRevisionDoc>;

function rewritePath(p: string, from: string, to: string): string {
  return p.replace(new RegExp(`^${from}/`), `${to}/`);
}

async function copyStorageFile(
  ctx: MigrationContext,
  src: string,
  dest: string,
): Promise<void> {
  if (ctx.dryRun) {
    console.log(`    [dry] copy storage: ${src} → ${dest}`);
    return;
  }
  const [exists] = await ctx.bucket.file(dest).exists();
  if (exists) {
    console.log(`    ~ already exists, skipping: ${dest}`);
    return;
  }
  console.log(`    ^ copy: ${src} → ${dest}`);
  await ctx.bucket.file(src).copy(ctx.bucket.file(dest));
}

async function copyCollection(
  ctx: MigrationContext,
  src: string,
  dest: string,
): Promise<void> {
  const { db, dryRun } = ctx;
  const snap = await db.collection(src).get();
  console.log(`Found ${snap.size} docs in ${src}\n`);

  for (const scoreDoc of snap.docs) {
    const id = scoreDoc.id;
    const destRef = db.collection(dest).doc(id);
    console.log(`score: ${id}`);

    const revisionsSnap = await db
      .collection(src)
      .doc(id)
      .collection("revisions")
      .get();

    const batch = db.batch();

    await Promise.all(
      revisionsSnap.docs.map(async (revDoc) => {
        const revId = revDoc.id;
        const rev: RevisionDoc = zRevisionDoc.parse(revDoc.data());
        const rw = (p: string) => rewritePath(p, src, dest);

        const newMscz = rw(rev.mscz);
        const newMetajson = rw(rev.metajson);
        const newMidi = rw(rev.midi);
        const newParts = rev.parts.map((p) => ({
          ...p,
          svg: p.svg.map(rw),
          midi: rw(p.midi),
        }));

        const srcPaths = [
          rev.mscz,
          rev.metajson,
          rev.midi,
          ...rev.parts.flatMap((p) => [...p.svg, p.midi]),
        ];
        const destPaths = [
          newMscz,
          newMetajson,
          newMidi,
          ...newParts.flatMap((p) => [...p.svg, p.midi]),
        ];

        console.log(`  revision: ${revId} (${srcPaths.length} files)`);

        await Promise.all(
          srcPaths.map((src, i) => copyStorageFile(ctx, src, destPaths[i])),
        );

        if (dryRun) {
          console.log(
            `  [dry] write firestore: ${dest}/${id}/revisions/${revId}`,
          );
        } else {
          batch.set(destRef.collection("revisions").doc(revId), {
            ...rev,
            mscz: newMscz,
            metajson: newMetajson,
            midi: newMidi,
            parts: newParts,
          });
          console.log(`  queued firestore: ${dest}/${id}/revisions/${revId}`);
        }
      }),
    );

    if (dryRun) {
      console.log(`  [dry] write firestore: ${dest}/${id}`);
    } else {
      batch.set(destRef, zScoreDoc.parse(scoreDoc.data()));
      await batch.commit();
      console.log(`  wrote firestore: ${dest}/${id} (+ revisions batch)`);
    }

    console.log("");
  }
}

async function deleteCollection(
  ctx: MigrationContext,
  collectionName: string,
): Promise<void> {
  const { db, bucket, dryRun } = ctx;
  const snap = await db.collection(collectionName).get();

  for (const doc of snap.docs) {
    const revisionsSnap = await db
      .collection(collectionName)
      .doc(doc.id)
      .collection("revisions")
      .get();

    if (dryRun) {
      for (const rev of revisionsSnap.docs) {
        console.log(
          `  [dry] delete firestore: ${collectionName}/${doc.id}/revisions/${rev.id}`,
        );
      }
      console.log(`  [dry] delete firestore: ${collectionName}/${doc.id}`);
      console.log(`  [dry] delete storage: ${collectionName}/${doc.id}/`);
    } else {
      const batch = db.batch();
      for (const rev of revisionsSnap.docs) {
        batch.delete(rev.ref);
      }
      batch.delete(doc.ref);
      await Promise.all([
        batch.commit(),
        bucket.deleteFiles({ prefix: `${collectionName}/${doc.id}/` }),
      ]);
      console.log(
        `  deleted firestore: ${collectionName}/${doc.id} (+ revisions batch)`,
      );
      console.log(`  deleted storage: ${collectionName}/${doc.id}/`);
    }
  }
}

const migration: Migration = {
  id: "20241015120000",
  description: "songs → scores collection rename",

  async up(ctx) {
    await copyCollection(ctx, "songs", "scores");
  },

  async cleanup(ctx) {
    await deleteCollection(ctx, "songs");
  },

  async down(ctx) {
    await copyCollection(ctx, "scores", "songs");
    await deleteCollection(ctx, "scores");
  },
};

export default migration;
