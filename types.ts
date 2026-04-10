import z from "zod";

export const zInstrument = z.enum([
  "bombardino",
  "clarinete",
  "flauta",
  "sax alto",
  "sax soprano",
  "sax tenor",
  "trombone",
  "trombone pirata",
  "trompete",
  "trompete pirata",
  "tuba",
  "tuba eb",
]);
export type Instrument = z.infer<typeof zInstrument>;

export const zPart = z.object({
  name: z.string(),
  instrument: zInstrument,
  svg: z.array(z.string()),
  midi: z.string(),
});
export type Part = z.infer<typeof zPart>;

export const zLegacyScore = z.object({
  id: z.string(),
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  mscz: z.string(),
  metajson: z.string(),
  midi: z.string(),
  parts: z.array(zPart),
  tags: z.array(z.string()),
  projectTitle: z.string(),
});
export type LegacyScore = z.infer<typeof zLegacyScore>;

export interface Project {
  title: string;
  scores: LegacyScore[];
}

export const zLegacyCollection = z.object({
  projects: z.array(z.object({ title: z.string(), scores: z.array(zLegacyScore) })),
  version: z.literal(3),
});

export type LegacyCollection = z.infer<typeof zLegacyCollection>;

export type PlayingPart = {
  score: LegacyScore;
  part: Part;
};

export type SongBookScore = {
  type: "score";
  score: LegacyScore;
};

export type SongBookSection = {
  type: "section";
  title: string;
};

export type SongBookItem = SongBookScore | SongBookSection;

export type SongBook = {
  items: SongBookItem[];
};

export const isSongBookSection = (row: SongBookItem): row is SongBookSection =>
  row.type === "section";

export const songBookScore = (score: LegacyScore): SongBookScore => ({
  type: "score",
  score: score,
});

export const songBookSection = (title: string): SongBookSection => ({
  type: "section",
  title,
});
