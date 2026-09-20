import { z } from "zod";
import type { Migration, MigrationContext } from "../lib/migration";

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

const zPart = z.object({
  name: z.string(),
  midi: z.object({ path: z.string() }).passthrough(),
}).passthrough();

const zRevisionParts = z.object({ parts: z.array(zPart) }).passthrough();

/** Strips an exact title prefix. A fuzzy match could silently corrupt a name. */
export function partNameFromStem(stem: string, title: string): string {
  for (const prefix of [`${title}-`, `${title.replace(/\//g, "-")}-`]) {
    if (stem.startsWith(prefix)) {
      return stem.slice(prefix.length).replace(/-/g, " ");
    }
  }
  return stem;
}

/** The original stem survives in the Storage path, so `down` is exact. */
export function stemFromMidiPath(midiPath: string): string | undefined {
  const match = /\/parts\/(.+)\.midi$/.exec(midiPath);
  return match?.[1];
}

const migration: Migration = {
  id: "202609201500",
  description: "revisions: parts[].name from filename stem to part name",

  async up(ctx: MigrationContext) {
    const { db, dryRun } = ctx;
    const scores = await db.collection("scores").get();
    console.log(`Found ${scores.size} scores\n`);

    let revisions = 0;
    let renamed = 0;

    for (const scoreSnap of scores.docs) {
      const title = (scoreSnap.data().title as string | undefined) ?? "";
      if (!title) {
        console.log(`  skip ${scoreSnap.id}: no title`);
        continue;
      }

      const revs = await scoreSnap.ref.collection("revisions").get();
      for (const revSnap of revs.docs) {
        const parsed = zRevisionParts.safeParse(revSnap.data());
        if (!parsed.success) {
          console.log(`  skip ${scoreSnap.id}/${revSnap.id}: unexpected shape`);
          continue;
        }
        revisions++;

        const parts = parsed.data.parts.map((part) => ({
          ...part,
          name: partNameFromStem(part.name, title),
        }));
        const changed = parts.some((part, i) => part.name !== parsed.data.parts[i].name);
        if (!changed) {
          continue;
        }
        renamed++;

        const preview = parts
          .map((p, i) => `${parsed.data.parts[i].name} → ${p.name}`)
          .join(", ");
        if (dryRun) {
          console.log(`  [dry] ${scoreSnap.id}/${revSnap.id}: ${preview}`);
          continue;
        }
        await revSnap.ref.update({ parts });
        console.log(`  updated ${scoreSnap.id}/${revSnap.id}: ${preview}`);
      }
    }

    console.log(`\n${renamed} of ${revisions} revisions renamed`);
  },

  async down(ctx: MigrationContext) {
    const { db, dryRun } = ctx;
    const scores = await db.collection("scores").get();

    for (const scoreSnap of scores.docs) {
      const revs = await scoreSnap.ref.collection("revisions").get();
      for (const revSnap of revs.docs) {
        const parsed = zRevisionParts.safeParse(revSnap.data());
        if (!parsed.success) {
          continue;
        }

        const parts = parsed.data.parts.map((part) => ({
          ...part,
          name: stemFromMidiPath(part.midi.path) ?? part.name,
        }));
        const changed = parts.some((part, i) => part.name !== parsed.data.parts[i].name);
        if (!changed) {
          continue;
        }
        if (dryRun) {
          console.log(`  [dry] restore ${scoreSnap.id}/${revSnap.id}`);
          continue;
        }
        await revSnap.ref.update({ parts });
        console.log(`  restored ${scoreSnap.id}/${revSnap.id}`);
      }
    }
  },
};

export default migration;
