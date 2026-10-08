import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import type { Migration, MigrationContext } from "../lib/migration";
import { authDisplayNames } from "../lib/authDisplayNames";
import { commitInChunks, type Write } from "../lib/batches";

/**
 * Turns each project's `members` map into `projects/{id}/members/{uid}` docs
 * (collab-flow M1b), which is what security rules read from now on. The map
 * stays on the project doc — flag-off code still reads it — until M9.
 *
 * `displayName` comes from Firebase Auth; `addedBy` is the project's owner,
 * the closest thing to the truth the map can offer.
 */

const zRole = z.enum(["owner", "admin", "editor", "reviewer"]);
const zProject = z
  .object({
    members: z.record(zRole).optional(),
    memberIds: z.array(z.string()),
  })
  .passthrough();

const migration: Migration = {
  id: "202610081201",
  description: "projects.members map → projects/*/members/{uid} docs",

  async up({ db, dryRun }: MigrationContext) {
    const projects = await db.collection("projects").get();
    const parsed = projects.docs.map((d) => ({
      ref: d.ref,
      project: zProject.parse(d.data()),
    }));
    const names = await authDisplayNames(
      parsed.flatMap(({ project }) => Object.keys(project.members ?? {})),
    );

    const writes: Write[] = [];
    for (const { ref, project } of parsed) {
      const members = Object.entries(project.members ?? {});
      const owners = members.filter(([, role]) => role === "owner");
      if (owners.length !== 1) {
        console.warn(`  ! ${ref.id}: ${owners.length} owners in the map`);
      }
      const addedBy = owners[0]?.[0];
      for (const [uid, role] of members) {
        if (dryRun) {
          console.log(
            `  [dry] ${ref.id}/members/${uid}: ${role} "${names.get(uid)}"`,
          );
        }
        writes.push((batch) =>
          batch.set(ref.collection("members").doc(uid), {
            uid,
            role,
            displayName: names.get(uid),
            addedBy: addedBy ?? uid,
            addedAt: FieldValue.serverTimestamp(),
          }),
        );
      }
      const missingIds = members
        .map(([uid]) => uid)
        .filter((uid) => !project.memberIds.includes(uid));
      if (missingIds.length > 0) {
        console.log(
          `  ${ref.id}: adding ${missingIds.length} uid(s) to memberIds`,
        );
        writes.push((batch) =>
          batch.update(ref, {
            memberIds: FieldValue.arrayUnion(...missingIds),
          }),
        );
      }
    }

    console.log(`\n${writes.length} writes across ${projects.size} projects`);
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },

  async down({ db, dryRun }: MigrationContext) {
    const members = await db.collectionGroup("members").get();
    const refs = members.docs
      .map((d) => d.ref)
      .filter((ref) => ref.parent.parent?.parent.id === "projects");
    console.log(`${refs.length} member docs to delete`);
    if (!dryRun) {
      await commitInChunks(
        db,
        refs.map((ref) => (batch) => batch.delete(ref)),
      );
    }
  },
};

export default migration;
