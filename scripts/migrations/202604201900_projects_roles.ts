import { z } from "zod";
import type { Migration, MigrationContext } from "../lib/migration";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  let i = 2;
  while (taken.has(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

const migration: Migration = {
  id: "202604201900",
  description: "projects: collaboratorIds → members/memberIds, slug as doc ID",

  async up(ctx: MigrationContext) {
    const zLegacyProjectDoc = z.object({
      title: z.string(),
      ownerId: z.string(),
      collaboratorIds: z.array(z.string()),
      createdAt: z.unknown(),
    });

    const { db, dryRun } = ctx;
    const snap = await db.collection("projects").get();
    console.log(`Found ${snap.size} projects\n`);

    const takenSlugs = new Set<string>();

    for (const docSnap of snap.docs) {
      const oldId = docSnap.id;
      const data = zLegacyProjectDoc.parse(docSnap.data());

      const slug = uniqueSlug(slugify(data.title), takenSlugs);
      takenSlugs.add(slug);

      const members: Record<string, string> = {
        [data.ownerId]: "owner",
      };
      for (const uid of data.collaboratorIds) {
        if (uid !== data.ownerId) members[uid] = "editor";
      }
      const memberIds = Object.keys(members);

      console.log(`project: ${oldId} → ${slug} (${memberIds.length} members)`);

      if (dryRun) {
        console.log(`  [dry] create projects/${slug}`);
        console.log(`  [dry] update scores where projectId == ${oldId}`);
        if (oldId !== slug) console.log(`  [dry] delete projects/${oldId}`);
        console.log("");
        continue;
      }

      const scoresSnap = await db
        .collection("scores")
        .where("projectId", "==", oldId)
        .get();

      const batch = db.batch();

      batch.set(db.collection("projects").doc(slug), {
        title: data.title,
        slug,
        members,
        memberIds,
        createdAt: data.createdAt,
      });

      for (const scoreDoc of scoresSnap.docs) {
        batch.update(scoreDoc.ref, { projectId: slug });
      }

      if (oldId !== slug) {
        batch.delete(docSnap.ref);
      }

      await batch.commit();
      console.log(
        `  migrated: projects/${slug}, updated ${scoresSnap.size} scores${oldId !== slug ? `, deleted projects/${oldId}` : ""}`,
      );
      console.log("");
    }
  },

  async down(ctx: MigrationContext) {
    const zNewProjectDoc = z.object({
      title: z.string(),
      slug: z.string(),
      members: z.record(z.string(), z.string()),
      memberIds: z.array(z.string()),
      createdAt: z.unknown(),
    });

    const { db, dryRun } = ctx;
    const snap = await db.collection("projects").get();
    console.log(`Found ${snap.size} projects\n`);

    for (const docSnap of snap.docs) {
      const data = zNewProjectDoc.parse(docSnap.data());
      const ownerId =
        Object.entries(data.members).find(([, role]) => role === "owner")?.[0] ?? "";
      const collaboratorIds = Object.entries(data.members)
        .filter(([, role]) => role !== "owner")
        .map(([uid]) => uid);

      const slug = docSnap.id;
      console.log(`project: ${slug} → auto-id`);

      if (dryRun) {
        console.log(`  [dry] create projects/{auto-id}`);
        console.log(`  [dry] delete projects/${slug}`);
        console.log("");
        continue;
      }

      const scoresSnap = await db
        .collection("scores")
        .where("projectId", "==", slug)
        .get();

      const newRef = db.collection("projects").doc();
      const batch = db.batch();

      batch.set(newRef, {
        title: data.title,
        ownerId,
        collaboratorIds,
        createdAt: data.createdAt,
      });

      for (const scoreDoc of scoresSnap.docs) {
        batch.update(scoreDoc.ref, { projectId: newRef.id });
      }

      if (newRef.id !== slug) {
        batch.delete(docSnap.ref);
      }

      await batch.commit();
      console.log(
        `  rolled back: projects/${newRef.id}, updated ${scoresSnap.size} scores`,
      );
      console.log("");
    }
  },
};

export default migration;
