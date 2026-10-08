import type { MigrationContext } from "./migration";

export const REVISION_COLLECTIONS = ["revisions", "scoreRevisions"] as const;

type Snapshot = FirebaseFirestore.QueryDocumentSnapshot;

/**
 * Every revision under `scores/{id}`, in both subcollections, grouped by score
 * id then revision id. Two collection-group queries instead of a fetch per
 * score.
 */
export async function revisionsByScore(
  db: MigrationContext["db"],
): Promise<Map<string, Map<string, Snapshot[]>>> {
  const byScore = new Map<string, Map<string, Snapshot[]>>();
  for (const name of REVISION_COLLECTIONS) {
    const snap = await db.collectionGroup(name).get();
    for (const d of snap.docs) {
      const score = d.ref.parent.parent;
      if (score?.parent.id !== "scores") {
        continue;
      }
      const revisions = byScore.get(score.id) ?? new Map<string, Snapshot[]>();
      revisions.set(d.id, [...(revisions.get(d.id) ?? []), d]);
      byScore.set(score.id, revisions);
    }
  }
  return byScore;
}

/** Revisions created before collab-flow have numeric ids ("1", "2", …). */
export const isLegacyRevisionId = (id: string): boolean => /^\d+$/.test(id);
