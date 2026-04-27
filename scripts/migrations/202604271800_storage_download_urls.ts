import { z } from "zod";
import { getDownloadURL } from "firebase-admin/storage";
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

function resolveUrl(ctx: MigrationContext, storagePath: string): Promise<string> {
  return getDownloadURL(ctx.bucket.file(storagePath));
}

const migration: Migration = {
  id: "202604271800",
  description: "convert storage path strings to { path, url } StorageFile objects",

  async up(ctx) {
    const { db, dryRun } = ctx;
    const scoresSnap = await db.collection("scores").get();
    console.log(`Found ${scoresSnap.size} scores\n`);

    for (const scoreDoc of scoresSnap.docs) {
      const revisionsSnap = await scoreDoc.ref.collection("revisions").get();
      console.log(`score: ${scoreDoc.id}`);

      for (const revDoc of revisionsSnap.docs) {
        const rev = zRevisionDoc.parse(revDoc.data());
        console.log(`  revision: ${revDoc.id}`);

        if (dryRun) {
          console.log(`  [dry] would convert path strings to StorageFile objects`);
          continue;
        }

        const [msczUrl, metajsonUrl, midiUrl] = await Promise.all([
          resolveUrl(ctx, rev.mscz),
          resolveUrl(ctx, rev.metajson),
          resolveUrl(ctx, rev.midi),
        ]);

        const parts = await Promise.all(
          rev.parts.map(async (part) => ({
            ...part,
            svg: await Promise.all(
              part.svg.map(async (p) => ({ path: p, url: await resolveUrl(ctx, p) })),
            ),
            midi: { path: part.midi, url: await resolveUrl(ctx, part.midi) },
          })),
        );

        await revDoc.ref.update({
          mscz: { path: rev.mscz, url: msczUrl },
          metajson: { path: rev.metajson, url: metajsonUrl },
          midi: { path: rev.midi, url: midiUrl },
          parts,
        });
        console.log(`    done`);
      }

      console.log("");
    }
  },

  async down(ctx) {
    const zStorageFile = z.object({ path: z.string(), url: z.string() });
    const zPartDataNew = z.object({
      name: z.string(),
      instrument: z.string(),
      svg: z.array(zStorageFile),
      midi: zStorageFile,
    });
    const zRevisionDocNew = z.object({
      mscz: zStorageFile,
      metajson: zStorageFile,
      midi: zStorageFile,
      parts: z.array(zPartDataNew),
    });

    const { db, dryRun } = ctx;
    const scoresSnap = await db.collection("scores").get();
    console.log(`Found ${scoresSnap.size} scores\n`);

    for (const scoreDoc of scoresSnap.docs) {
      const revisionsSnap = await scoreDoc.ref.collection("revisions").get();
      console.log(`score: ${scoreDoc.id}`);

      for (const revDoc of revisionsSnap.docs) {
        const rev = zRevisionDocNew.parse(revDoc.data());
        console.log(`  revision: ${revDoc.id}`);

        if (dryRun) {
          console.log(`  [dry] would revert StorageFile objects to path strings`);
          continue;
        }

        await revDoc.ref.update({
          mscz: rev.mscz.path,
          metajson: rev.metajson.path,
          midi: rev.midi.path,
          parts: rev.parts.map((part) => ({
            ...part,
            svg: part.svg.map((f) => f.path),
            midi: part.midi.path,
          })),
        });
        console.log(`    done`);
      }

      console.log("");
    }
  },
};

export default migration;
