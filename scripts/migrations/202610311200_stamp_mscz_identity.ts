import type { Migration, MigrationContext } from "../lib/migration";
import { readMsczIdentity, stampMsczIdentity } from "../lib/msczIdentity";
import { revisionsByScore } from "../lib/scoreRevisions";

/**
 * Writes each stored .mscz's own score and version ids into it, as uploads do
 * from now on, so a file downloaded from cadern.in carries its lineage
 * (collab-flow §5.3). The file stays at its path and keeps its custom metadata,
 * whose download token is what stored URLs depend on; only metadata in the
 * score changes, not the music. Stamped files are skipped, so a run that fails
 * partway can be repeated.
 *
 * `down` does nothing: the ids are harmless and removing them would rewrite
 * every file again.
 */

const CONCURRENCY = 8;

const migration: Migration = {
  id: "202610311200",
  description: "scores: stamp each stored .mscz with its own ids",

  async up({ db, bucket, dryRun }: MigrationContext) {
    const byScore = await revisionsByScore(db);
    const jobs: { path: string; scoreId: string; revisionId: string }[] = [];
    for (const [scoreId, revisions] of byScore) {
      for (const [revisionId, copies] of revisions) {
        const path = copies[0].get("mscz.path") as string | undefined;
        if (path) {
          jobs.push({ path, scoreId, revisionId });
        }
      }
    }
    console.log(`${jobs.length} versions`);
    if (dryRun) {
      return;
    }

    let stamped = 0;
    let skipped = 0;
    const missing: string[] = [];
    const failed: string[] = [];
    const stampOne = async (job: (typeof jobs)[number]) => {
      const file = bucket.file(job.path);
      try {
        const [exists] = await file.exists();
        if (!exists) {
          missing.push(job.path);
          return;
        }
        const [metadata] = await file.getMetadata();
        const [bytes] = await file.download();
        const identity = { scoreId: job.scoreId, revisionId: job.revisionId };
        const current = readMsczIdentity(bytes);
        if (
          current?.scoreId === identity.scoreId &&
          current.revisionId === identity.revisionId
        ) {
          skipped++;
          return;
        }
        await file.save(stampMsczIdentity(bytes, identity), {
          resumable: false,
          metadata: {
            contentType: metadata.contentType,
            metadata: metadata.metadata,
          },
        });
        stamped++;
      } catch (error) {
        failed.push(`${job.path}: ${String(error)}`);
      }
    };

    const queue = [...jobs];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          await stampOne(job);
          if ((stamped + skipped) % 100 === 0) {
            console.log(`  ${stamped + skipped}/${jobs.length}`);
          }
        }
      }),
    );

    console.log(
      `${stamped} stamped, ${skipped} already stamped, ` +
        `${missing.length} missing, ${failed.length} failed`,
    );
    for (const path of missing) {
      console.warn(`  ! missing: ${path}`);
    }
    if (failed.length > 0) {
      failed.forEach((f) => console.error(`  ! ${f}`));
      throw new Error(`${failed.length} files failed; safe to re-run.`);
    }
  },

  async down() {
    console.log("Nothing to do; the ids stay in the files.");
  },
};

export default migration;
