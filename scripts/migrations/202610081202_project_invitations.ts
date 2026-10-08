import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import type { Migration, MigrationContext } from "../lib/migration";
import { authDisplayNames } from "../lib/authDisplayNames";
import { commitInChunks, type Write } from "../lib/batches";

/**
 * Moves pending top-level `invitations/{autoId}` to
 * `projects/{projectId}/invitations/{toUserId}` (collab-flow M1c), the path
 * security rules can find when the invitee accepts. Keeps the newest pending
 * invitation per (project, invitee) and fills the denormalized names.
 *
 * Moved originals get `deletedAt` + `migratedAt`, which takes them out of the
 * pending queries; `down` uses `migratedAt` to put them back. Invitations at
 * a role an admin can no longer grant (admin, owner) are skipped.
 */

const INVITABLE = ["editor", "reviewer"];

const zInvitation = z
  .object({
    fromUserId: z.string(),
    toUserId: z.string(),
    projectId: z.string(),
    role: z.string(),
    accepted: z.boolean().nullable(),
    createdAt: z.custom<Timestamp>(),
    deletedAt: z.unknown().nullable().optional(),
  })
  .passthrough();

const migration: Migration = {
  id: "202610081202",
  description: "invitations/{autoId} → projects/*/invitations/{toUserId}",

  async up({ db, dryRun }: MigrationContext) {
    const snap = await db.collection("invitations").get();
    const pending = snap.docs
      .map((d) => ({ ref: d.ref, inv: zInvitation.parse(d.data()) }))
      .filter(({ inv }) => inv.accepted === null && !inv.deletedAt);
    console.log(`${pending.length} pending of ${snap.size} invitations`);

    const newest = new Map<string, (typeof pending)[number]>();
    for (const entry of pending) {
      const key = `${entry.inv.projectId}/${entry.inv.toUserId}`;
      const current = newest.get(key);
      if (
        !current ||
        entry.inv.createdAt.toMillis() > current.inv.createdAt.toMillis()
      ) {
        newest.set(key, entry);
      }
    }

    const projectIds = [...new Set(pending.map(({ inv }) => inv.projectId))];
    const projects = await Promise.all(
      projectIds.map((id) => db.collection("projects").doc(id).get()),
    );
    const titles = new Map(
      projects.map((p) => [
        p.id,
        (p.get("title") as string | undefined) ?? p.id,
      ]),
    );
    const names = await authDisplayNames(
      pending.flatMap(({ inv }) => [inv.fromUserId, inv.toUserId]),
    );

    const writes: Write[] = [];
    for (const { inv } of newest.values()) {
      if (!INVITABLE.includes(inv.role)) {
        console.warn(
          `  ! skipping ${inv.projectId}/${inv.toUserId}: role ${inv.role}`,
        );
        continue;
      }
      if (dryRun) {
        console.log(
          `  [dry] ${inv.projectId}/invitations/${inv.toUserId} (${inv.role})`,
        );
      }
      writes.push((batch) =>
        batch.set(
          db
            .collection("projects")
            .doc(inv.projectId)
            .collection("invitations")
            .doc(inv.toUserId),
          {
            fromUserId: inv.fromUserId,
            toUserId: inv.toUserId,
            projectId: inv.projectId,
            role: inv.role,
            accepted: null,
            projectTitle: titles.get(inv.projectId),
            fromDisplayName: names.get(inv.fromUserId),
            toDisplayName: names.get(inv.toUserId),
            createdAt: inv.createdAt,
            updatedAt: FieldValue.serverTimestamp(),
            deletedAt: null,
          },
        ),
      );
    }
    for (const { ref } of pending) {
      writes.push((batch) =>
        batch.update(ref, {
          deletedAt: FieldValue.serverTimestamp(),
          migratedAt: FieldValue.serverTimestamp(),
        }),
      );
    }

    console.log(`\n${writes.length} writes`);
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },

  async down({ db, dryRun }: MigrationContext) {
    const moved = await db
      .collection("invitations")
      .where("migratedAt", "!=", null)
      .get();
    const writes: Write[] = [];
    for (const d of moved.docs) {
      const inv = zInvitation.parse(d.data());
      writes.push((batch) =>
        batch.delete(
          db
            .collection("projects")
            .doc(inv.projectId)
            .collection("invitations")
            .doc(inv.toUserId),
        ),
      );
      writes.push((batch) =>
        batch.update(d.ref, {
          deletedAt: null,
          migratedAt: FieldValue.delete(),
        }),
      );
    }
    console.log(`${moved.size} invitations to restore`);
    if (!dryRun) {
      await commitInChunks(db, writes);
    }
  },
};

export default migration;
