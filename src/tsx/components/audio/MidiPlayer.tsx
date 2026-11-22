import "html-midi-player";
import { useEffect, useRef } from "react";

export type SoundFont = "chrono_trigger" | "sgm_plus";

// chrono_trigger was taken down by Google (404 since 2026-11), which left the
// player stuck in its error state with a disabled play button.
const SOUNDFONT_URLS: Record<SoundFont, string> = {
  chrono_trigger: "https://storage.googleapis.com/magentadata/js/soundfonts/chrono_trigger",
  sgm_plus: "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",
};

interface Props {
  src: string;
  soundFont?: SoundFont;
}

export function MidiPlayer({ src, soundFont = "sgm_plus" }: Props) {
  const ref = useRef<HTMLElement & { stop?: () => void }>(null);

  useEffect(() => {
    const el = ref.current;
    return () => { el?.stop?.(); };
  }, []);

  return <midi-player ref={ref} src={src} sound-font={SOUNDFONT_URLS[soundFont]} />;
}
