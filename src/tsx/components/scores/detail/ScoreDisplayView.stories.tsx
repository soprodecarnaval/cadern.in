import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { ScoreDisplayView, type ScoreDisplayPart } from "./ScoreDisplayView";
import type { MidiPlayerProps } from "../../audio/MidiPlayer";
import { cursorFixtureFrames, cursorFixturePages } from "../playbackCursor.fixture";

const DURATION_MS = cursorFixtureFrames.at(-1)?.timeMs ?? 0;

const part: ScoreDisplayPart = {
  name: "Flauta",
  instrument: "flauta",
  svgUrls: cursorFixturePages.map((svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`),
  midiUrl: "#fixture-midi",
  playback: {
    midiUrl: "#fixture-midi",
    timingUrl: `data:application/json,${encodeURIComponent(JSON.stringify({ version: 1, frames: cursorFixtureFrames }))}`,
  },
};

/**
 * Stands in for the MIDI player without audio: a clock that reports the
 * playback time as html-midi-player does, through onPlaybackTime.
 */
function fakePlayer(autoplay: boolean, startMs: number) {
  return function FakeMidiPlayer({ onPlaybackTime }: MidiPlayerProps) {
    const [playing, setPlaying] = useState(autoplay);
    const [time, setTime] = useState(startMs);
    const clockMs = useRef(startMs);
    const report = useRef(onPlaybackTime);
    report.current = onPlaybackTime;
    useEffect(() => {
      // Paused at a set time: report it once, as a seek would.
      if (!autoplay && startMs > 0) {report.current?.(startMs / 1000);}
    }, []);
    useEffect(() => {
      if (!playing) {return;}
      let frame = 0;
      let last = performance.now();
      const tick = (now: number) => {
        const elapsed = clockMs.current + (now - last);
        // Loop with a short pause after the last note.
        clockMs.current = elapsed > DURATION_MS + 800 ? 0 : elapsed;
        last = now;
        setTime(clockMs.current);
        report.current?.(clockMs.current <= DURATION_MS ? clockMs.current / 1000 : null);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, [playing]);
    return (
      <div className="d-flex align-items-center gap-2 my-2">
        <button type="button" className="btn btn-primary" aria-label={playing ? "Pausar" : "Reproduzir"}
          onClick={() => { if (playing) {report.current?.(null);} setPlaying(!playing); }}>
          {playing ? "❚❚" : "▶"}
        </button>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{(Math.min(time, DURATION_MS) / 1000).toFixed(1)} s</span>
      </div>
    );
  };
}

const meta = {
  title: "Components/ScoreDisplay",
  component: ScoreDisplayView,
  args: {
    MidiPlayer: fakePlayer(true, 0),
    title: "Melodia de exemplo",
    composer: "Compositor de exemplo",
    sub: "",
    tags: [],
    parts: [part],
  },
} satisfies Meta<typeof ScoreDisplayView>;
export default meta;
type Story = StoryObj<typeof meta>;

// The band glides through the music while the playing note keeps its glow.
export const Playing: Story = {};

// Paused in bar 6, on the second page: the band and the glow are on that page.
export const PausedOnSecondPage: Story = {
  args: { MidiPlayer: fakePlayer(false, 12450) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const band = await canvas.findByTestId("playback-cursor", {}, { timeout: 5000 });
    // The band is drawn on the page it is in, over that page's score frame.
    await expect(band.parentElement?.querySelector("iframe")).toHaveAttribute("title", "Flauta · Página 2");
  },
};
