import { z } from "zod";
import type { Migration, MigrationContext } from "../lib/migration";

const zLegacySongbookDoc = z.object({
  title: z.string(),
  ownerId: z.string(),
  slug: z.string(),
  isPublished: z.boolean(),
  entries: z.array(z.unknown()),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
});

const migration: Migration = {
  id: "202604201901",
  description: "songbooks: ownerId (uid) → projectId (project slug)",

  async up(ctx: MigrationContext) {
    const { db, dryRun } = ctx;

    // Build uid → project slug map (owner of each project)
    const projectsSnap = await db.collection("projects").get();
    const ownerToSlug = new Map<string, string>();
    for (const doc of projectsSnap.docs) {
      const members: Record<string, string> = doc.data().members ?? {};
      const ownerEntry = Object.entries(members).find(
        ([, role]) => role === "owner",
      );
      if (ownerEntry) ownerToSlug.set(ownerEntry[0], doc.id);
    }

    const snap = await db.collection("songbooks").get();
    console.log(`Found ${snap.size} songbooks\n`);

    for (const docSnap of snap.docs) {
      const data = zLegacySongbookDoc.parse(docSnap.data());
      const projectId = ownerToSlug.get(data.ownerId);

      if (!projectId) {
        console.warn(
          `  ! no project found for ownerId ${data.ownerId}, skipping ${docSnap.id}`,
        );
        continue;
      }

      console.log(
        `songbook: ${docSnap.id} — ownerId ${data.ownerId} → projectId ${projectId}`,
      );

      if (dryRun) {
        console.log(`  [dry] update songbooks/${docSnap.id}`);
        continue;
      }

      await docSnap.ref.update({ projectId, ownerId: null });
      console.log(`  updated songbooks/${docSnap.id}`);
    }
  },

  async down(ctx: MigrationContext) {
    const { db, dryRun } = ctx;

    // Build project slug → owner uid map
    const projectsSnap = await db.collection("projects").get();
    const slugToOwner = new Map<string, string>();
    for (const doc of projectsSnap.docs) {
      const members: Record<string, string> = doc.data().members ?? {};
      const ownerEntry = Object.entries(members).find(
        ([, role]) => role === "owner",
      );
      if (ownerEntry) slugToOwner.set(doc.id, ownerEntry[0]);
    }

    const snap = await db.collection("songbooks").get();
    console.log(`Found ${snap.size} songbooks\n`);

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const projectId: string = data.projectId;
      const ownerId = slugToOwner.get(projectId);

      if (!ownerId) {
        console.warn(
          `  ! no owner found for projectId ${projectId}, skipping ${docSnap.id}`,
        );
        continue;
      }

      console.log(
        `songbook: ${docSnap.id} — projectId ${projectId} → ownerId ${ownerId}`,
      );

      if (dryRun) {
        console.log(`  [dry] update songbooks/${docSnap.id}`);
        continue;
      }

      await docSnap.ref.update({ ownerId, projectId: null });
      console.log(`  updated songbooks/${docSnap.id}`);
    }
  },
};

export default migration;
