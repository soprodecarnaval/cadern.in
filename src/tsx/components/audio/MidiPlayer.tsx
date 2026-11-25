import "html-midi-player";
import { useEffect, useRef } from "react";
import "./MidiPlayer.css";

export type SoundFont = "chrono_trigger" | "sgm_plus";

// chrono_trigger was taken down by Google (404 since 2026-11), which left the
// player stuck in its error state with a disabled play button.
const SOUNDFONT_URLS: Record<SoundFont, string> = {
  chrono_trigger: "https://storage.googleapis.com/magentadata/js/soundfonts/chrono_trigger",
  sgm_plus: "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",
};

export interface MidiPlayerProps {
  src: string;
  soundFont?: SoundFont;
  onPlaybackTime?: (seconds: number | null) => void;
}

type MidiElement = HTMLElement & {
  stop?: () => void;
  currentTime: number;
  duration: number;
  seeking?: boolean;
  seekBar?: HTMLInputElement;
  displayCurrentTime?: (seconds: number) => void;
};

export function MidiPlayer({ src, soundFont = "sgm_plus", onPlaybackTime }: MidiPlayerProps) {
  const ref = useRef<MidiElement>(null);
  const report = useRef(onPlaybackTime);
  report.current = onPlaybackTime;
  useEffect(() => {
    const el = ref.current;
    return () => { el?.stop?.(); };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) {return;}
    let animation = 0;
    let position = 0;
    let began = 0;
    let observed = 0;
    const sync = (seconds: number) => {
      position = seconds;
      observed = seconds;
      began = performance.now();
    };
    const tick = (now: number) => {
      // html-midi-player moves its seek bar and time label only on note onsets and seeks, so they
      // freeze through rests and breaks. Interpolate between them, for the clock and the highlight.
      if (el.currentTime !== observed || el.seeking) {sync(el.currentTime);}
      const seconds = Math.min(position + Math.max(0, now - began) / 1000, el.duration || Infinity);
      if (!el.seeking && el.seekBar && el.displayCurrentTime) {
        // Written to the bar directly: the currentTime setter would seek.
        el.seekBar.value = String(seconds);
        el.displayCurrentTime(seconds);
        observed = el.currentTime;
      }
      report.current?.(el.seeking ? null : seconds);
      animation = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(animation);
      sync(el.currentTime);
      animation = requestAnimationFrame(tick);
    };
    const note = (event: Event) => {
      const seconds = (event as CustomEvent<{ note: { startTime: number } }>).detail.note.startTime;
      if (!el.seeking && Number.isFinite(seconds)) {sync(seconds);}
    };
    const stop = () => {
      cancelAnimationFrame(animation);
      report.current?.(null);
    };
    el.addEventListener("start", start);
    el.addEventListener("loop", start);
    el.addEventListener("note", note);
    el.addEventListener("stop", stop);
    return () => {
      cancelAnimationFrame(animation);
      el.removeEventListener("start", start);
      el.removeEventListener("loop", start);
      el.removeEventListener("note", note);
      el.removeEventListener("stop", stop);
    };
  }, [src]);

  if (!src) {
    return <div className="midi-player-pending" role="status">
      <button type="button" aria-label="Reproduzir" disabled>▶</button>
      <span>Carregando áudio…</span>
    </div>;
  }
  return <midi-player ref={ref} src={src} sound-font={SOUNDFONT_URLS[soundFont]} />;
}
