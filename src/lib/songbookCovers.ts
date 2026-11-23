import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import { storage } from "../firebase";
import { zInstrument, type Instrument } from "../../types/instrument";
import type { SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import {
  createSongbookRevision,
  getSongbookRevision,
  newSongbookRevisionId,
  type WithId,
} from "./db";
import { slugify } from "./slugify";
import { songbookRevisionStoragePath } from "./storagePaths";

export const COVER_TYPES = ["image/png", "image/jpeg"];

/**
 * One cover to represent the whole songbook: the first instrument, in the
 * instrument list's order, that has one.
 */
export function representativeCoverUrl(
  covers: SongbookRevisionDoc["covers"],
): string | undefined {
  for (const instrument of zInstrument.options) {
    const url = covers[instrument]?.url;
    if (url) {
      return url;
    }
  }
  return undefined;
}

/** Each instrument's cover image, for the instruments that have one. */
export type CoverUrls = Partial<Record<Instrument, string>>;

/**
 * The songbook with its current revision's covers: `coverUrls` per instrument
 * and `coverUrl`, the representative one. Without covers, or if the revision
 * fails to load, it comes back without them.
 */
export async function withCovers<T extends WithId<SongbookDoc>>(
  songbook: T,
): Promise<T & { coverUrl?: string; coverUrls?: CoverUrls }> {
  try {
    const revision = await getSongbookRevision(
      songbook.id,
      songbook.currentRevisionId,
    );
    if (!revision) {
      return songbook;
    }
    const coverUrls: CoverUrls = {};
    for (const [instrument, file] of Object.entries(revision.covers)) {
      if (file?.url) {
        coverUrls[instrument as Instrument] = file.url;
      }
    }
    const coverUrl = representativeCoverUrl(revision.covers);
    return coverUrl ? { ...songbook, coverUrl, coverUrls } : songbook;
  } catch (err) {
    console.error(`Failed to load the cover of ${songbook.id}`, err);
    return songbook;
  }
}

/**
 * Uploads the new covers under the next revision's path, then creates that
 * revision with the same entries and pins and the updated covers. The note
 * lists what changed.
 */
export async function saveSongbookCovers(input: {
  songbook: WithId<SongbookDoc>;
  current: SongbookRevisionDoc;
  added: Map<Instrument, File>;
  removed: Instrument[];
  user: User;
}): Promise<SongbookRevisionDoc["covers"]> {
  for (const file of input.added.values()) {
    if (!COVER_TYPES.includes(file.type)) {
      throw new Error("Selecione uma imagem PNG ou JPEG.");
    }
  }
  const revisionId = newSongbookRevisionId(input.songbook.title);
  const base = songbookRevisionStoragePath(
    input.songbook.projectId, input.songbook.id, revisionId,
  );
  const covers = { ...input.current.covers };
  for (const instrument of input.removed) {
    delete covers[instrument];
  }
  for (const [instrument, file] of input.added) {
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${base}/covers/${slugify(instrument)}.${ext}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type });
    covers[instrument] = { path, url: await getDownloadURL(fileRef) };
  }

  const changes = [
    ...[...input.added.keys()],
    ...input.removed.map((i) => `sem ${i}`),
  ];
  await createSongbookRevision(
    input.songbook.id,
    { entries: input.current.entries, pins: input.current.pins, covers },
    {
      createdBy: input.user.uid,
      note: `capas: ${changes.join(", ")}`,
      revisionId,
    },
  );
  return covers;
}
