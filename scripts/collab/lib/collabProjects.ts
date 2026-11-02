import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { UserProjectRole } from "../../../types/docs";
import { catalogJournal, assertCatalog, type CollabCatalog } from "./collabCatalog";
import { commitInChunks, type Write } from "../../lib/batches";
import { authDisplayNames } from "../../lib/authDisplayNames";
import { applyReviewedScores, planReviewedScores } from "./collabReview";

const rank: Record<UserProjectRole, number> = { reviewer: 0, editor: 1, admin: 2, owner: 3 };

export function planProjectMembers(catalog: CollabCatalog, owner: string) {
  const errors = [...catalog.errors, ...planReviewedScores(catalog).errors];
  const targets = new Map<string, { title: string; roles: Map<string, UserProjectRole> }>();
  for (const row of catalog.assignments) {
    const bookId = `${row.project}~${row.songbook}`;
    if (row.songbook !== null && catalog.books.has(bookId) && catalog.bookJournals.get(bookId)?.source !== row.source) {
      errors.push(`Unrelated songbook already occupies ${row.project}/${row.songbook}`);
    }
    const target = targets.get(row.project) ?? { title: row.title, roles: new Map<string, UserProjectRole>() };
    for (const projectId of new Set([row.source, row.project])) {
      const project = catalog.projects.get(projectId);
      if (!project) continue;
      if (row.songbook !== null && projectId === row.project && project.deletedAt) errors.push(`Destination project is deleted: ${projectId}`);
      const docs = catalog.members.filter((member) => member.projectId === projectId);
      const roles = docs.length ? docs.map((member) => [member.uid, member.role] as const) : Object.entries(project.members ?? {});
      const owners = roles.filter(([, role]) => role === "owner");
      if (owners.length !== 1 || owners[0][0] !== owner) errors.push(`Project must be owned solely by CADERNIN: ${projectId}`);
      for (const [uid, role] of roles) {
        const current = target.roles.get(uid);
        if (!current || rank[role as UserProjectRole] > rank[current]) target.roles.set(uid, role as UserProjectRole);
      }
    }
    if ((row.source !== row.project || row.songbook === null) && [...catalog.books.values()].some(({ book }) => book.projectId === row.source && !book.deletedAt)) {
      errors.push(`Source project has live songbooks; reconcile before archiving: ${row.source}`);
    }
    target.roles.set(owner, "owner");
    if (row.songbook !== null) targets.set(row.project, target);
  }
  return { targets, errors };
}

export async function migrateProjects(db: Firestore, catalog: CollabCatalog, owner: string, dryRun: boolean) {
  const { targets, errors } = planProjectMembers(catalog, owner);
  assertCatalog(errors);
  console.log(`${targets.size} destination projects; source assignments journaled before score moves`);
  if (dryRun) {
    await applyReviewedScores(db, catalog, true);
    return;
  }

  const names = await authDisplayNames([...targets.values()].flatMap((target) => [...target.roles.keys()]));
  const timestamp = Timestamp.now();
  await commitInChunks(db, catalog.assignments.filter((row) => !catalog.savedSources.has(row.source)).map((row) =>
    (batch) => batch.create(catalogJournal(db).collection("projects").doc(row.source), { ...row, createdAt: timestamp }),
  ));

  const writes: Write[] = [];
  for (const [id, target] of targets) {
    const existing = catalog.projects.get(id);
    const ref = db.collection("projects").doc(id);
    if (!existing) {
      writes.push((batch) => batch.create(ref, {
        title: target.title, slug: id, createdAt: timestamp, deletedAt: null,
        members: Object.fromEntries(target.roles), memberIds: [...target.roles.keys()],
      }));
    } else {
      writes.push((batch) => batch.update(ref, {
        members: Object.fromEntries(target.roles), memberIds: FieldValue.arrayUnion(...target.roles.keys()),
      }));
    }
    for (const [uid, role] of target.roles) {
      const current = catalog.members.find((member) => member.projectId === id && member.uid === uid);
      if (current) {
        if (current.role !== role) writes.push((batch) => batch.update(ref.collection("members").doc(uid), { role }));
      } else {
        writes.push((batch) => batch.create(ref.collection("members").doc(uid), {
          uid, role, displayName: names.get(uid), addedBy: owner, addedAt: timestamp,
        }));
      }
    }
  }
  await commitInChunks(db, writes);

  for (const row of catalog.assignments) {
    if (row.source === row.project && row.songbook !== null) continue;
    // A transaction refuses to move a score that changed projects after the report.
    for (let offset = 0; row.source !== row.project && offset < row.scoreIds.length; offset += 200) {
      const ids = row.scoreIds.slice(offset, offset + 200);
      await db.runTransaction(async (transaction) => {
        const docs = await transaction.getAll(...ids.map((id) => db.collection("scores").doc(id)));
        for (const doc of docs) {
          if (!doc.exists) throw new Error(`Score disappeared during M6: ${doc.id}`);
          const project = doc.get("projectId");
          if (project === row.source) transaction.update(doc.ref, { projectId: row.project });
          else if (project !== row.project) throw new Error(`Score changed projects during M6: ${doc.id}`);
        }
      });
    }
    await db.runTransaction(async (transaction) => {
      const remaining = await transaction.get(db.collection("scores").where("projectId", "==", row.source));
      const unexpected = row.songbook === null ? remaining.docs.some((doc) => !row.scoreIds.includes(doc.id)) : !remaining.empty;
      if (unexpected) throw new Error(`Source has unexpected scores; stop writers and retry: ${row.source}`);
      const ref = db.collection("projects").doc(row.source);
      const project = await transaction.get(ref);
      const invitations = await transaction.get(ref.collection("invitations"));
      for (const invite of invitations.docs) {
        if (invite.get("accepted") == null && !invite.get("deletedAt")) transaction.update(invite.ref, { deletedAt: timestamp });
      }
      if (!project.get("deletedAt")) transaction.update(ref, { deletedAt: timestamp });
    });
  }
  await applyReviewedScores(db, catalog, false);
}
