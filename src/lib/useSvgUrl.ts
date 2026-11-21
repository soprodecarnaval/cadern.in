import { useEffect, useState } from "react";
import { fontFaceCss, loadTextFonts, needsTextFonts, withTextFonts } from "./sharedFonts";

/**
 * A URL to show a stored part SVG as an image. Library-rendered pages name
 * shared text fonts without embedding them (014), and an <img> SVG can't load
 * outside fonts, so they are embedded again here and shown from a blob URL.
 * Other SVGs (MuseScore exports) are shown as they are. Falls back to the
 * original URL if anything fails.
 */
export function useSvgUrl(url: string): string {
  const [shown, setShown] = useState(url);
  useEffect(() => {
    let current = true;
    let blobUrl: string | null = null;
    setShown(url);
    void (async () => {
      try {
        const svg = await (await fetch(url)).text();
        if (!current) {return;}
        const fonts = await loadTextFonts().catch(() => []);
        if (!current || !needsTextFonts(svg, fonts.map(({ font }) => font.family))) {return;}
        blobUrl = URL.createObjectURL(new Blob([withTextFonts(svg, fontFaceCss(fonts))], { type: "image/svg+xml" }));
        setShown(blobUrl);
      } catch {
        // Keep the original URL.
      }
    })();
    return () => {
      current = false;
      if (blobUrl) {URL.revokeObjectURL(blobUrl);}
    };
  }, [url]);
  return shown;
}
