import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import { storage } from "../firebase";
import { parseInstrument } from "../instrument";
import type { Instrument } from "../../types/instrument";
import type { SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import { createSongbookRevision, newSongbookRevisionId, type WithId } from "./db";
import { slugify } from "./slugify";

export const COVER_TYPES = ["image/png", "image/jpeg"];

/**
 * Matches cover images to instruments by filename (`capa-trompete.png` →
 * trompete), like part files on upload. Files that aren't PNG/JPEG or name no
 * known instrument come back in `unmatched`; a later file for the same
 * instrument wins.
 */
export function matchCoverFiles(files: File[]): {
  matched: Map<Instrument, File>;
  unmatched: string[];
} {
  const matched = new Map<Instrument, File>();
  const unmatched: string[] = [];
  for (const file of files) {
    const instrument = COVER_TYPES.includes(file.type)
      ? parseInstrument(file.name.replace(/\.[^.]+$/, ""))
      : undefined;
    if (instrument) {
      matched.set(instrument, file);
    } else {
      unmatched.push(file.name);
    }
  }
  return { matched, unmatched };
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
}): Promise<void> {
  const revisionId = newSongbookRevisionId(input.songbook.title);
  const covers = { ...input.current.covers };
  for (const instrument of input.removed) {
    delete covers[instrument];
  }
  for (const [instrument, file] of input.added) {
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `songbooks/${input.songbook.id}/${revisionId}/covers/${slugify(instrument)}.${ext}`;
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
}
