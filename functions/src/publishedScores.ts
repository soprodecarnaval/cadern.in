import type {
  DocumentData,
  Firestore,
  Timestamp,
} from "firebase-admin/firestore";

/** `scores/{id}.published` (collab-flow §2.2.1). */
export interface PublishedMarker {
  revisionId: string;
  songbookIds: string[];
}

export interface MarkerChange {
  scoreId: string;
  before: PublishedMarker | null;
  after: PublishedMarker | null;
}

interface SongbookPins {
  pins: Record<string, string>;
  createdAt: number;
}

/**
 * Reads shared across one recompute, so a songbook or project consulted for
 * many scores is fetched once.
 */
class Lookups {
  private projects = new Map<string, Promise<boolean>>();
  private songbooks = new Map<string, Promise<SongbookPins | null>>();

  /** @param {Firestore} db The database. */
  constructor(private db: Firestore) {}

  /**
   * Whether a project exists and isn't soft-deleted.
   * @param {string} projectId The project.
   * @return {Promise<boolean>} Whether it is live.
   */
  projectAlive(projectId: string): Promise<boolean> {
    if (!this.projects.has(projectId)) {
      this.projects.set(
        projectId,
        this.db.collection("projects").doc(projectId).get()
          .then((p) => p.exists && !p.get("deletedAt")),
      );
    }
    return this.projects.get(projectId) as Promise<boolean>;
  }

  /**
   * A songbook's current pins, if it is published, live and in a live
   * project; `null` otherwise.
   * @param {string} songbookId The songbook.
   * @return {Promise<SongbookPins | null>} Its pins, or null.
   */
  publishedPins(songbookId: string): Promise<SongbookPins | null> {
    if (!this.songbooks.has(songbookId)) {
      this.songbooks.set(songbookId, this.loadPublishedPins(songbookId));
    }
    return this.songbooks.get(songbookId) as Promise<SongbookPins | null>;
  }

  /**
   * Uncached {@link publishedPins}.
   * @param {string} songbookId The songbook.
   * @return {Promise<SongbookPins | null>} Its pins, or null.
   */
  private async loadPublishedPins(
    songbookId: string,
  ): Promise<SongbookPins | null> {
    const songbook = await this.db.collection("songbooks").doc(songbookId)
      .get();
    if (!songbook.exists || songbook.get("isPublished") !== true ||
        songbook.get("deletedAt") ||
        !(await this.projectAlive(songbook.get("projectId")))) {
      return null;
    }
    const revision = await songbook.ref.collection("songbookRevisions")
      .doc(songbook.get("currentRevisionId")).get();
    if (!revision.exists) {
      return null;
    }
    return {
      pins: (revision.get("pins") ?? {}) as Record<string, string>,
      createdAt:
        (revision.get("createdAt") as Timestamp | undefined)?.toMillis() ?? 0,
    };
  }
}

const sameMarker = (a: PublishedMarker | null, b: PublishedMarker | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Recomputes `published` for the given scores (collab-flow §2.2.1). A score's
 * candidates are the songbooks its marker already lists plus `extra`; it is
 * published by those that are published, live, in a live project and pin it
 * in their current revision. The most recently created of those revisions
 * names the published version. Deleted scores, or scores of deleted projects,
 * are never published. Only changed markers are written.
 * @param {Firestore} db The database.
 * @param {Iterable<string>} scoreIds The scores to recompute.
 * @param {object} options `extra` candidates per score; `dryRun` to only
 *   report.
 * @return {Promise<MarkerChange[]>} The markers that changed.
 */
export async function recomputePublished(
  db: Firestore,
  scoreIds: Iterable<string>,
  options: {
    extra?: (scoreId: string) => string[];
    dryRun?: boolean;
  } = {},
): Promise<MarkerChange[]> {
  const lookups = new Lookups(db);
  const changes: MarkerChange[] = [];

  for (const scoreId of new Set(scoreIds)) {
    const score = await db.collection("scores").doc(scoreId).get();
    if (!score.exists) {
      continue;
    }
    const before = (score.get("published") ?? null) as PublishedMarker | null;
    let after: PublishedMarker | null = null;

    if (!score.get("deletedAt") &&
        (await lookups.projectAlive(score.get("projectId")))) {
      const candidates = new Set([
        ...(before?.songbookIds ?? []),
        ...(options.extra?.(scoreId) ?? []),
      ]);
      const matches: { songbookId: string; revisionId: string;
        createdAt: number; }[] = [];
      for (const songbookId of candidates) {
        const songbook = await lookups.publishedPins(songbookId);
        const revisionId = songbook?.pins[scoreId];
        if (songbook && revisionId) {
          matches.push({ songbookId, revisionId,
            createdAt: songbook.createdAt });
        }
      }
      if (matches.length > 0) {
        const newest = matches.reduce((a, b) =>
          b.createdAt > a.createdAt ? b : a);
        after = {
          revisionId: newest.revisionId,
          songbookIds: matches.map((m) => m.songbookId).sort(),
        };
      }
    }

    if (!sameMarker(before, after)) {
      changes.push({ scoreId, before, after });
      if (!options.dryRun) {
        await score.ref.update({ published: after });
      }
    }
  }
  return changes;
}

/**
 * The score ids a songbook revision pins.
 * @param {Firestore} db The database.
 * @param {string} songbookId The songbook.
 * @param {string | undefined} revisionId The revision, if any.
 * @return {Promise<string[]>} Its pinned score ids.
 */
async function pinnedScoreIds(
  db: Firestore,
  songbookId: string,
  revisionId: string | undefined,
): Promise<string[]> {
  if (!revisionId) {
    return [];
  }
  const revision = await db.collection("songbooks").doc(songbookId)
    .collection("songbookRevisions").doc(revisionId).get();
  return Object.keys((revision.get("pins") ?? {}) as Record<string, string>);
}

/**
 * Every published, live songbook. A restored score or project has no marker
 * left to list its songbooks, so restores consider all of these — few, and
 * one query.
 * @param {Firestore} db The database.
 * @return {Promise<string[]>} Their ids.
 */
async function publishedSongbookIds(db: Firestore): Promise<string[]> {
  const snap = await db.collection("songbooks")
    .where("isPublished", "==", true)
    .where("deletedAt", "==", null)
    .get();
  return snap.docs.map((d) => d.id);
}

const changed = (
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  fields: string[],
) => fields.some((f) => JSON.stringify(before?.[f] ?? null) !==
  JSON.stringify(after?.[f] ?? null));

const deletionChanged = (
  before: DocumentData | undefined,
  after: DocumentData | undefined,
) => Boolean(before?.deletedAt) !== Boolean(after?.deletedAt);

/**
 * A songbook was published, unpublished, deleted or moved to another
 * revision: recompute the scores its old and new revisions pin.
 * @param {Firestore} db The database.
 * @param {string} songbookId The songbook.
 * @param {DocumentData | undefined} before Its data before the write.
 * @param {DocumentData | undefined} after Its data after the write.
 * @return {Promise<MarkerChange[]>} The markers that changed.
 */
export async function onSongbookWritten(
  db: Firestore,
  songbookId: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
): Promise<MarkerChange[]> {
  if (before && after && !deletionChanged(before, after) &&
      !changed(before, after, ["currentRevisionId", "isPublished"])) {
    return [];
  }
  const scoreIds = [
    ...await pinnedScoreIds(db, songbookId, before?.currentRevisionId),
    ...await pinnedScoreIds(db, songbookId, after?.currentRevisionId),
  ];
  return recomputePublished(db, scoreIds, { extra: () => [songbookId] });
}

/**
 * A score was soft-deleted or restored.
 * @param {Firestore} db The database.
 * @param {string} scoreId The score.
 * @param {DocumentData | undefined} before Its data before the write.
 * @param {DocumentData | undefined} after Its data after the write.
 * @return {Promise<MarkerChange[]>} The markers that changed.
 */
export async function onScoreWritten(
  db: Firestore,
  scoreId: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
): Promise<MarkerChange[]> {
  if (!after || !deletionChanged(before, after)) {
    return [];
  }
  const restored = !after.deletedAt;
  const songbookIds = restored ? await publishedSongbookIds(db) : [];
  return recomputePublished(db, [scoreId], { extra: () => songbookIds });
}

/**
 * A project was soft-deleted or restored: recompute its own scores and every
 * score its songbooks pin.
 * @param {Firestore} db The database.
 * @param {string} projectId The project.
 * @param {DocumentData | undefined} before Its data before the write.
 * @param {DocumentData | undefined} after Its data after the write.
 * @return {Promise<MarkerChange[]>} The markers that changed.
 */
export async function onProjectWritten(
  db: Firestore,
  projectId: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
): Promise<MarkerChange[]> {
  if (!deletionChanged(before, after)) {
    return [];
  }
  const [scores, songbooks] = await Promise.all([
    db.collection("scores").where("projectId", "==", projectId).get(),
    db.collection("songbooks").where("projectId", "==", projectId).get(),
  ]);
  const pinned = await Promise.all(songbooks.docs.map((sb) =>
    pinnedScoreIds(db, sb.id, sb.get("currentRevisionId"))));
  const songbookIds = [
    ...songbooks.docs.map((sb) => sb.id),
    // Restored: other projects' songbooks may pin this one's scores too.
    ...(after?.deletedAt ? [] : await publishedSongbookIds(db)),
  ];
  return recomputePublished(
    db,
    [...scores.docs.map((s) => s.id), ...pinned.flat()],
    { extra: () => songbookIds },
  );
}

/**
 * Every score, recomputed against every songbook — for migrations and to
 * repair drift.
 * @param {Firestore} db The database.
 * @param {boolean} dryRun Only report.
 * @return {Promise<MarkerChange[]>} The markers that changed.
 */
export async function rebuildPublished(
  db: Firestore,
  dryRun: boolean,
): Promise<MarkerChange[]> {
  const [scores, songbooks] = await Promise.all([
    db.collection("scores").get(),
    db.collection("songbooks").get(),
  ]);
  const pinnedBy = new Map<string, string[]>();
  for (const sb of songbooks.docs) {
    for (const scoreId of
      await pinnedScoreIds(db, sb.id, sb.get("currentRevisionId"))) {
      pinnedBy.set(scoreId, [...(pinnedBy.get(scoreId) ?? []), sb.id]);
    }
  }
  return recomputePublished(db, scores.docs.map((s) => s.id), {
    extra: (scoreId) => pinnedBy.get(scoreId) ?? [],
    dryRun,
  });
}
