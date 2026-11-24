import { z } from "zod";

const frame = z.object({
  timeMs: z.number().finite().nonnegative(),
  notes: z.array(z.string()),
});

export const zScorePlaybackTiming = z.object({
  version: z.literal(1),
  frames: z.array(frame).nonempty().refine((frames) => frames.every(
    (entry, index) => index === 0 || entry.timeMs >= frames[index - 1].timeMs,
  ), "Playback frames must be sorted by time"),
});

export type PlaybackFrame = z.infer<typeof frame>;
