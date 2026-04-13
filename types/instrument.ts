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
