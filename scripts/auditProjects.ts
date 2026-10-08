/**
 * Read-only inventory of projects and scores, to check what the collab-flow
 * migrations will meet (DEPLOY.md). Writes nothing.
 *
 * Usage:
 *   tsx --env-file=<env file> scripts/auditProjects.ts
 *
 * Reports, per project: owner(s) and members from the legacy `members` map,
 * member docs, and live/deleted scores. Flags projects CADERNIN does not own
 * and scores whose project does not exist.
 */

import { getFirestore } from "firebase-admin/firestore";
import { CADERNIN_UID, FIRESTORE_DATABASE_ID } from "./lib/env";
import { initAdminApp } from "./lib/firebaseAdmin";
import { authDisplayNames } from "./lib/authDisplayNames";

interface ProjectRow {
  id: string;
  title: string;
  owners: string[];
  mapMembers: number;
  memberDocs: number;
  liveScores: number;
  deletedScores: number;
}

async function main(): Promise<void> {
  initAdminApp();
  const db = getFirestore(FIRESTORE_DATABASE_ID);

  const [schema, projects, scores, invitations] = await Promise.all([
    db.collection("_meta").doc("schema").get(),
    db.collection("projects").get(),
    db.collection("scores").get(),
    db.collection("invitations").count().get(),
  ]);

  console.log(`schema version: ${schema.get("version") ?? "(none)"}`);
  console.log(`CADERNIN uid:   ${CADERNIN_UID}\n`);

  const rows = new Map<string, ProjectRow>();
  for (const p of projects.docs) {
    const members = (p.get("members") ?? {}) as Record<string, string>;
    const memberDocs = await p.ref.collection("members").count().get();
    rows.set(p.id, {
      id: p.id,
      title: (p.get("title") as string | undefined) ?? "",
      owners: Object.entries(members)
        .filter(([, role]) => role === "owner")
        .map(([uid]) => uid),
      mapMembers: Object.keys(members).length,
      memberDocs: memberDocs.data().count,
      liveScores: 0,
      deletedScores: 0,
    });
  }

  const orphans: string[] = [];
  for (const s of scores.docs) {
    const row = rows.get(s.get("projectId") as string);
    if (!row) {
      orphans.push(`${s.id} (projectId: ${s.get("projectId")})`);
    } else if (s.get("deletedAt")) {
      row.deletedScores++;
    } else {
      row.liveScores++;
    }
  }

  const names = await authDisplayNames(
    [...rows.values()].flatMap((r) => r.owners),
  );
  const ownerLabel = (uid: string) =>
    uid === CADERNIN_UID ? "CADERNIN" : `${names.get(uid)} (${uid})`;

  console.table(
    [...rows.values()].map((r) => ({
      project: r.id,
      title: r.title,
      owners: r.owners.map(ownerLabel).join(", ") || "—",
      "map members": r.mapMembers,
      "member docs": r.memberDocs,
      "live scores": r.liveScores,
      "deleted scores": r.deletedScores,
    })),
  );

  const notCadernin = [...rows.values()].filter(
    (r) => !(r.owners.length === 1 && r.owners[0] === CADERNIN_UID),
  );
  console.log(`\n${projects.size} projects, ${scores.size} scores`);
  console.log(`legacy top-level invitations: ${invitations.data().count}`);
  console.log(
    `projects not solely owned by CADERNIN: ${notCadernin.length}` +
      (notCadernin.length
        ? ` — ${notCadernin.reduce((n, r) => n + r.liveScores, 0)} live scores in them`
        : ""),
  );
  for (const r of notCadernin) {
    console.log(
      `  - ${r.id}: ${r.owners.map(ownerLabel).join(", ") || "no owner"}`,
    );
  }
  console.log(`scores with no project doc: ${orphans.length}`);
  for (const o of orphans) {
    console.log(`  - ${o}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
