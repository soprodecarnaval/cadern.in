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

export type ScoreViewModel = {
  id: string;
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  projectTitle: string;
  mscz: string;
  metajson: string;
  midi: string;
  parts: Part[];
};

export type PlayingPart = {
  score: ScoreViewModel;
  part: Part;
};

export type SongBookScore = {
  type: "score";
  score: ScoreViewModel;
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

export const songBookScore = (score: ScoreViewModel): SongBookScore => ({
  type: "score",
  score: score,
});

export const songBookSection = (title: string): SongBookSection => ({
  type: "section",
  title,
});
