import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import "../../../styles/tokens.css";
import { ScoreSvgFrame } from "./ScoreSvgFrame";
import { PlaybackBand } from "./PlaybackBand";
import { measureCursorGeometry as measure, type PageCursorGeometry } from "./cursorGeometry";
import { cursorFixtureFrames, cursorFixtureSvg } from "./playbackCursor.fixture";
import { notesAtTime } from "../../../lib/browserScore/playbackNotes";
import {
  cursorAnchors,
  cursorAt,
  type CursorMotion,
} from "../../../lib/browserScore/playbackCursor";

/*
 * Mockup: a cursor that moves through the score while the MIDI plays, with or
 * without the glow behind each note. The score view uses BandWithGlow. The clock is simulated (no audio), so the
 * story runs without a soundfont.
 */

type Style = "glow" | "bar" | "band";

const STYLES: { value: Style; label: string }[] = [
  { value: "glow", label: "Brilho (atual)" },
  { value: "bar", label: "Barra" },
  { value: "band", label: "Faixa" },
];
const MOTIONS: { value: CursorMotion; label: string }[] = [
  { value: "smooth", label: "Contínuo" },
  { value: "step", label: "Por nota" },
];

const DURATION_MS = cursorFixtureFrames.at(-1)?.timeMs ?? 0;
const viewBox = /viewBox="([^"]+)"/.exec(cursorFixtureSvg)?.[1].split(/\s+/).map(Number) ?? [0, 0, 4, 1];
const ASPECT = `${viewBox[2]} / ${viewBox[3]}`;

type Geometry = PageCursorGeometry;

function useClock(autoplay: boolean, initialMs: number) {
  const [time, setTime] = useState(initialMs);
  const [playing, setPlaying] = useState(autoplay);
  useEffect(() => {
    if (!playing) {return;}
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      setTime((t) => {
        const next = t + (now - last);
        // Loop with a short pause after the last note.
        return next > DURATION_MS + 800 ? 0 : next;
      });
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  return { time, setTime, playing, setPlaying };
}

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function CursorOverlay({ geometry, time, style, motion }: { geometry: Geometry; time: number; style: Exclude<Style, "glow">; motion: CursorMotion }) {
  const anchors = useMemo(
    () => cursorAnchors(cursorFixtureFrames, (id) => geometry.targets.get(id), geometry.systems),
    [geometry],
  );
  const cursor = cursorAt(anchors, geometry.systems, time, motion);
  if (!cursor) {return null;}
  const system = geometry.systems[cursor.system];
  if (style === "band") {return <PlaybackBand x={cursor.x} top={system.top} bottom={system.bottom} />;}
  const height = system.bottom - system.top;
  // A hairline with an ink edge.
  const width = 3;
  return (
    <div
      aria-hidden="true"
      data-testid="playback-cursor"
      style={{
        position: "absolute",
        left: cursor.x - width / 2,
        top: system.top,
        width,
        height,
        pointerEvents: "none",
        background: "var(--ds-yellow)",
        boxShadow: "0 0 0 1px var(--ds-ink)",
        borderRadius: 2,
      }}
    />
  );
}

function PlaybackCursorMockup({ initialStyle, initialMotion, initialGlow, autoplay, initialMs }: {
  initialStyle: Style;
  initialGlow: boolean;
  initialMotion: CursorMotion;
  autoplay: boolean;
  initialMs: number;
}) {
  const [style, setStyle] = useState(initialStyle);
  const [motion, setMotion] = useState(initialMotion);
  const [glow, setGlow] = useState(initialGlow);
  const { time, setTime, playing, setPlaying } = useClock(autoplay, initialMs);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const doc = useRef<Document | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const remeasure = useCallback(() => {
    if (doc.current) {setGeometry(measure(doc.current));}
  }, []);
  useEffect(() => {
    const element = page.current;
    if (!element) {return;}
    const observer = new ResizeObserver(remeasure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [remeasure]);

  const activeNotes = style === "glow" || glow ? notesAtTime(cursorFixtureFrames, time / 1000) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-space-3)", maxWidth: 900 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-space-4)", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" aria-label={playing ? "Pausar" : "Reproduzir"} onClick={() => setPlaying(!playing)}>
          {playing ? "❚❚" : "▶"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--ds-space-2)", flex: "1 1 12rem" }}>
          <span>Posição</span>
          <input type="range" min={0} max={DURATION_MS} step={10} value={Math.min(time, DURATION_MS)}
            onChange={(event) => setTime(Number(event.currentTarget.value))} style={{ flex: 1 }} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{clock(time)} / {clock(DURATION_MS)}</span>
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-space-5)" }}>
        <fieldset>
          <legend style={{ fontSize: "inherit", fontWeight: 600 }}>Estilo</legend>
          {STYLES.map((option) => (
            <label key={option.value} style={{ marginRight: "var(--ds-space-3)" }}>
              <input type="radio" name="cursor-style" value={option.value} checked={style === option.value}
                onChange={() => setStyle(option.value)} /> {option.label}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={style === "glow"}>
          <legend style={{ fontSize: "inherit", fontWeight: 600 }}>Movimento</legend>
          {MOTIONS.map((option) => (
            <label key={option.value} style={{ marginRight: "var(--ds-space-3)" }}>
              <input type="radio" name="cursor-motion" value={option.value} checked={motion === option.value}
                onChange={() => setMotion(option.value)} /> {option.label}
            </label>
          ))}
        </fieldset>
        <label style={{ alignSelf: "end" }}>
          <input type="checkbox" checked={style === "glow" || glow} disabled={style === "glow"}
            onChange={(event) => setGlow(event.currentTarget.checked)} /> Brilho na nota
        </label>
      </div>
      <div ref={page} style={{ position: "relative", width: "100%", aspectRatio: ASPECT, background: "var(--ds-paper)", border: "1px solid var(--ds-muted)" }}>
        <ScoreSvgFrame
          svg={cursorFixtureSvg}
          label="Partitura de exemplo · Flauta"
          activeNotes={activeNotes}
          tabIndex={-1}
          onReady={(ready) => { doc.current = ready; remeasure(); }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
        />
        {geometry && style !== "glow" && <CursorOverlay geometry={geometry} time={time} style={style} motion={motion} />}
      </div>
    </div>
  );
}

const meta = {
  title: "Components/PlaybackCursor",
  component: PlaybackCursorMockup,
  args: { initialStyle: "band", initialMotion: "smooth", initialGlow: true, autoplay: true, initialMs: 0 },
  decorators: [(Story) => <div style={{ padding: "var(--ds-space-4)" }}><Story /></div>],
  argTypes: {
    initialStyle: { control: "inline-radio", options: STYLES.map((s) => s.value) },
    initialMotion: { control: "inline-radio", options: MOTIONS.map((m) => m.value) },
  },
} satisfies Meta<typeof PlaybackCursorMockup>;
export default meta;
type Story = StoryObj<typeof meta>;

// The chosen design, as in the score view: a continuous band, with the glow kept on each note.
export const BandWithGlow: Story = {};
export const Band: Story = { args: { initialGlow: false } };
export const Bar: Story = { args: { initialStyle: "bar", initialGlow: false } };
export const BarStepping: Story = { args: { initialMotion: "step", initialGlow: false } };
export const CurrentGlow: Story = { args: { initialStyle: "glow" } };

// Paused mid-rest in bar 4, where today's glow sits on the rest and the cursor keeps moving.
export const PausedInRest: Story = {
  args: { initialStyle: "bar", initialGlow: false, autoplay: false, initialMs: 8700 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId("playback-cursor");
    await userEvent.click(canvas.getByRole("radio", { name: "Brilho (atual)" }));
    await expect(canvas.queryByTestId("playback-cursor")).toBeNull();
    await expect(canvas.getByRole("group", { name: "Movimento" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("radio", { name: "Faixa" }));
    await expect(await canvas.findByTestId("playback-cursor")).toBeVisible();
  },
};
