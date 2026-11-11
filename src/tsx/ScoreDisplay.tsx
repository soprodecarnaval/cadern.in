import type { ComponentProps } from "react";
import { MidiPlayer } from "./MidiPlayer";
import { ScoreDisplayView } from "./ScoreDisplayView";
export type {
  ScoreDisplayPart,
  ScorePin,
  ScorePinsProps,
} from "./ScoreDisplayView";
export function ScoreDisplay(
  props: Omit<ComponentProps<typeof ScoreDisplayView>, "MidiPlayer">,
) {
  return <ScoreDisplayView {...props} MidiPlayer={MidiPlayer} />;
}
