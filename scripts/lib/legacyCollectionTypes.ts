import z from "zod";

const zLegacyPartData = z.object({
  name: z.string(),
  instrument: z.string(),
  svg: z.array(z.string()),
  midi: z.string(),
});

export const zLegacyScore = z.object({
  id: z.string(),
  title: z.string(),
  composer: z.string(),
  sub: z.string(),
  mscz: z.string(),
  metajson: z.string(),
  midi: z.string(),
  parts: z.array(zLegacyPartData),
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
