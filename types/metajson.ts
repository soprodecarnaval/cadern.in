import z from "zod";
import { zInstrument } from "./instrument";

/**
 * The sidecar written next to an exported score. It is the only channel between
 * the export app and the uploader: the web app has no MuseScore process and no
 * .mscx at upload time, so anything the filenames cannot carry must live here.
 */
export const METAJSON_VERSION = 2;

export const zMetajsonPart = z.object({
  /** Arbitrary, as authored in MuseScore. Never derived from a filename. */
  name: z.string(),
  instrument: zInstrument,
  /** Page files in reading order. Order is meaning; names are not parsed. */
  svg: z.array(z.string()),
  midi: z.string(),
});
export type MetajsonPart = z.infer<typeof zMetajsonPart>;

export const zMetajson = z.object({
  version: z.literal(METAJSON_VERSION),
  composer: z.string(),
  previousSource: z.string(),
  poet: z.string(),
  parts: z.array(zMetajsonPart),
});
export type Metajson = z.infer<typeof zMetajson>;

/**
 * Pre-v2 sidecars carry only the metadata fields, leaving part names and
 * instruments to be guessed from filenames. Accepted on read so old exported
 * folders still upload; see scripts/backfillMetajson.ts.
 */
export const zLegacyMetajson = z.object({
  version: z.undefined(),
  composer: z.string().optional(),
  previousSource: z.string().optional(),
  poet: z.string().optional(),
});
export type LegacyMetajson = z.infer<typeof zLegacyMetajson>;

export const isMetajsonV2 = (value: unknown): value is Metajson =>
  zMetajson.safeParse(value).success;
