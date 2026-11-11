import { PartItemView, type PartItemProps } from "./PartItemView";
import { midiPlayer, playMidiPart } from "../utils/playMidi";

export function PartItem(props: PartItemProps) {
  return (
    <PartItemView
      {...props}
      play={(part) => playMidiPart(part.midi, part.instrument)}
      stop={() => midiPlayer?.stop()}
    />
  );
}
