import "html-midi-player";
import { useEffect, useRef } from "react";

export type SoundFont = "chrono_trigger" | "sgm_plus";

const SOUNDFONT_URLS: Record<SoundFont, string> = {
  chrono_trigger: "https://storage.googleapis.com/magentadata/js/soundfonts/chrono_trigger",
  sgm_plus: "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",
};

interface Props {
  src: string;
  soundFont?: SoundFont;
}

export function MidiPlayer({ src, soundFont = "chrono_trigger" }: Props) {
  const ref = useRef<HTMLElement & { stop?: () => void }>(null);

  useEffect(() => {
    const el = ref.current;
    return () => { el?.stop?.(); };
  }, []);

  return <midi-player ref={ref} src={src} sound-font={SOUNDFONT_URLS[soundFont]} />;
}
