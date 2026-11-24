import z from "zod";

export const zInstrument = z.enum([
  "trompete",
  "trompete pirata",
  "trombone",
  "trombone pirata",
  "sax alto",
  "sax soprano",
  "sax tenor",
  "sax baritono",
  "flauta",
  "bombardino",
  "tuba",
  "tuba eb",
  "clarinete",
]);
export type Instrument = z.infer<typeof zInstrument>;


const instrumentOrder = new Map<string, number>(zInstrument.options.map((instrument, index) => [instrument, index]));

export function compareInstrumentOrder(a: string | null, b: string | null): number {
  return (instrumentOrder.get(a ?? "") ?? instrumentOrder.size) -
    (instrumentOrder.get(b ?? "") ?? instrumentOrder.size);
}
