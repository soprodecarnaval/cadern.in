import "html-midi-player";
import { useEffect, useRef } from "react";

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

type MidiElement = HTMLElement & { stop?: () => void; currentTime: number; seeking?: boolean };

export function MidiPlayer({ src, soundFont = "sgm_plus", onPlaybackTime }: MidiPlayerProps) {
  const ref = useRef<MidiElement>(null);
  const report = useRef(onPlaybackTime);
  report.current = onPlaybackTime;
  const trackPlayback = !!onPlaybackTime;

  useEffect(() => {
    const el = ref.current;
    return () => { el?.stop?.(); };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !trackPlayback) {return;}
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
      // html-midi-player updates currentTime on note onsets and seeks.
      // Interpolate between them so note-offs and rests clear the highlight.
      if (el.currentTime !== observed || el.seeking) {sync(el.currentTime);}
      report.current?.(el.seeking ? null : position + Math.max(0, now - began) / 1000);
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
  }, [src, trackPlayback]);

  return <midi-player ref={ref} src={src} sound-font={SOUNDFONT_URLS[soundFont]} />;
}
