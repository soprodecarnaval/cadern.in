import { ScoreCardView, type ScoreCardProps } from "./ScoreCardView";
import { LineageBadge } from "./LineageBadge";
import { PreviewModal } from "./PreviewModal";
import { midiPlayer, playMidiPart } from "../utils/playMidi";
export type { ScoreCardHighlight } from "./ScoreCardView";

export function ScoreCard(props: ScoreCardProps) {
  return (
    <ScoreCardView
      {...props}
      lineage={
        props.mode === "expanded" ? (
          <LineageBadge scoreId={props.score.id} />
        ) : null
      }
      play={(part) => playMidiPart(part.midi, part.instrument)}
      stop={() => midiPlayer?.stop()}
      renderPreview={(parts, index, setIndex) => (
        <PreviewModal
          show
          handleShow={(show) => setIndex(show ? index : null)}
          parts={parts}
          activeIndex={index}
          onIndexChange={setIndex}
        />
      )}
    />
  );
}
